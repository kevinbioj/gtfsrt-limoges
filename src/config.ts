import { Temporal } from "temporal-polyfill";

export const PORT = 3000;
export const REQUESTOR_REF = "opendata";
export const SIRI_ENDPOINT =
	"https://api.okina.fr/gateway/nam/realtime/anshar/ws/services/?datasetId=CA_LIMOGES_METROPOLE";
export const SIRI_RATELIMIT = Temporal.Duration.from({ seconds: 30 }).total("milliseconds");
export const SWEEP_THRESHOLD = Temporal.Duration.from({ minutes: 10 }).total("milliseconds");
