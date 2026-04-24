import { GET_ESTIMATED_TIMETABLE } from "./payloads.js";
import { requestSiri } from "./request-siri.js";
import type { GetEstimatedTimetableResponse, SoapResponse } from "./types.js";

export async function getEstimatedTimetable(url: string, requestorRef: string, lineRefs: string[]) {
	const payload = (await requestSiri(
		url,
		GET_ESTIMATED_TIMETABLE(requestorRef, lineRefs),
	)) as SoapResponse<GetEstimatedTimetableResponse>;

	const frames =
		payload.Envelope.Body.GetEstimatedTimetableResponse.Answer.EstimatedTimetableDelivery.EstimatedJourneyVersionFrame;

	if (frames === undefined) {
		return [];
	} else if (!Array.isArray(frames)) {
		return [frames];
	}

	return frames;
}
