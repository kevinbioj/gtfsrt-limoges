import { setTimeout } from "node:timers/promises";

import { serve } from "@hono/node-server";
import GtfsRealtime from "gtfs-realtime-bindings";
import { Hono } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { Temporal } from "temporal-polyfill";

import { PORT, REQUESTOR_REF, SIRI_ENDPOINT, SIRI_RATELIMIT } from "./config.js";
import { handleRequest } from "./gtfs-rt/handle-request.js";
import { useRealtimeStore } from "./gtfs-rt/use-realtime-store.js";
import { getEstimatedTimetable } from "./siri/fetch-estimated-timetable.js";
import { fetchMonitoredLines } from "./siri/fetch-monitored-lines.js";

console.log(` ,----.,--------.,------.,---.        ,------.,--------. ,--.   ,--.                                      
'  .-./'--.  .--'|  .---'   .-',-----.|  .--. '--.  .--' |  |   \`--',--,--,--. ,---. ,---.  ,---.  ,---.  
|  | .---.|  |   |  \`--,\`.  \`-.'-----'|  '--'.'  |  |    |  |   ,--.|        || .-. | .-. || .-. :(  .-'  
'  '--'  ||  |   |  |\`  .-'    |      |  |\\  \\   |  |    |  '--.|  ||  |  |  |' '-' ' '-' '\\   --..-'  \`) 
 \`------' \`--'   \`--'   \`-----'       \`--' '--'  \`--'    \`-----'\`--'\`--\`--\`--' \`---'.\`-  /  \`----'\`----'  
                                                                                    \`---'`);

const store = useRealtimeStore();

const hono = new Hono();
hono.use(
	rateLimiter({
		windowMs: 10_000,
		limit: 1,
		keyGenerator: (c) => `${c.req.header("CF-Connecting-IP")}_${c.req.method}_${c.req.path}`,
		handler: (c) => c.json({ code: 429, message: "Too many requests, please try again later." }, 429),
	}),
);
hono.get("/trip-updates", (c) => handleRequest(c, "protobuf", store.tripUpdates, null));
hono.get("/trip-updates.json", (c) => handleRequest(c, "json", store.tripUpdates, null));
hono.get("/vehicle-positions", (c) => handleRequest(c, "protobuf", null, store.vehiclePositions));
hono.get("/vehicle-positions.json", (c) => handleRequest(c, "json", null, store.vehiclePositions));
hono.get("/", (c) =>
	handleRequest(c, c.req.query("format") === "json" ? "json" : "protobuf", store.tripUpdates, store.vehiclePositions),
);
serve({ fetch: hono.fetch, port: PORT });
console.log(`➔ Listening on :${PORT}`);

let monitoredLines = await fetchMonitoredLines(SIRI_ENDPOINT, REQUESTOR_REF);
let monitoredLinesUpdatedAt = Date.now();

while (true) {
	await setTimeout(SIRI_RATELIMIT);

	if (
		monitoredLines.length === 0 ||
		Date.now() - monitoredLinesUpdatedAt >= Temporal.Duration.from({ hours: 1 }).total("milliseconds")
	) {
		console.log("➔ Updating monitored lines list from SIRI");
		try {
			monitoredLines = await fetchMonitoredLines(SIRI_ENDPOINT, REQUESTOR_REF);
			monitoredLinesUpdatedAt = Date.now();
			console.log(`✓ ${monitoredLines.length} lines to be monitored have been registered`);
		} catch (cause) {
			console.error(`✘ Failed to update monitored lines`, cause);
		}

		continue;
	}

	try {
		const journeyFrames = await getEstimatedTimetable(SIRI_ENDPOINT, REQUESTOR_REF, monitoredLines);
		console.log("► Handling %d journey frames", journeyFrames.length);

		for (const journeyFrame of journeyFrames) {
			if (journeyFrame.EstimatedVehicleJourney === undefined) {
				continue;
			}

			const recordedAt = Temporal.Instant.from(journeyFrame.RecordedAtTime);
			console.log(`► Frame recorded at %s.`, recordedAt);

			const journeys = Array.isArray(journeyFrame.EstimatedVehicleJourney)
				? journeyFrame.EstimatedVehicleJourney
				: [journeyFrame.EstimatedVehicleJourney];

			for (const journey of journeys) {
				if (journey.EstimatedCalls.EstimatedCall === undefined) {
					continue;
				}

				const tripId = journey.FramedVehicleJourneyRef.DataFrameRef;
				const routeId = journey.LineRef;
				const directionId = journey.DirectionName === "A" ? 0 : 1;
				const vehicleId = journey.VehicleRef;

				console.log(`   ${tripId} | Route: ${routeId} | Direction: ${directionId} | Vehicle: ${vehicleId ?? "None"}`);

				const estimatedCalls = Array.isArray(journey.EstimatedCalls.EstimatedCall)
					? journey.EstimatedCalls.EstimatedCall
					: [journey.EstimatedCalls.EstimatedCall];

				store.tripUpdates.set(`ET:${tripId}`, {
					trip: {
						tripId,
						routeId,
						directionId,
						scheduleRelationship: GtfsRealtime.transit_realtime.TripDescriptor.ScheduleRelationship.SCHEDULED,
					},
					timestamp: Math.floor(recordedAt.epochMilliseconds / 1000),
					stopTimeUpdate: estimatedCalls.map((estimatedCall) => {
						const expectedArrivalTime = Temporal.Instant.from(estimatedCall.ExpectedArrivalTime);
						const event = { time: Math.floor(expectedArrivalTime.epochMilliseconds / 1000) };

						return {
							arrival: event,
							departure: event,
							scheduleRelationship:
								GtfsRealtime.transit_realtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SCHEDULED,
							stopId: estimatedCall.StopPointRef,
							stopSequence: estimatedCall.Order,
						};
					}),
					vehicle: vehicleId ? { id: vehicleId, label: vehicleId } : undefined,
				});
			}
		}
	} catch (cause) {
		const error = new Error("Failed to refresh data", { cause });
		console.error(error);
	} finally {
		await setTimeout(30_000);
	}
}
