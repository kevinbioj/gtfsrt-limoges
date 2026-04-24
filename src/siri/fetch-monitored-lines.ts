import { LINES_DISCOVERY } from "./payloads.js";
import { requestSiri } from "./request-siri.js";
import type { LinesDiscoveryResponse, SoapResponse } from "./types.js";

export async function fetchMonitoredLines(siriEndpoint: string, requestorRef: string) {
	const payload = (await requestSiri(
		siriEndpoint,
		LINES_DISCOVERY(requestorRef),
	)) as SoapResponse<LinesDiscoveryResponse>;

	try {
		const annotatedLines = payload.Envelope.Body.LinesDiscoveryResponse.Answer.AnnotatedLineRef ?? [];
		return annotatedLines
			.filter((annotatedLine) => annotatedLine.Monitored)
			.map((annotatedLine) => annotatedLine.LineRef);
	} catch (e) {
		console.error(e);
		return [];
	}
}
