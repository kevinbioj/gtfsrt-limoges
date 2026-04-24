export type SoapResponse<T> = {
	Envelope: SoapEnvelope<T>;
};

export type SoapEnvelope<T> = {
	Body: SoapBody<T>;
};

export type SoapBody<T> = T;

// --- WS LinesDiscovery

export type LinesDiscoveryResponse = {
	LinesDiscoveryResponse: {
		Answer: {
			ResponseTimestamp: string;
			Status: boolean;
			AnnotatedLineRef?: AnnotatedLineRef[];
		};
	};
};

export type AnnotatedLineRef = {
	LineRef: string;
	Monitored: boolean;
};

// --- WS GetEstimatedTimetable

export type GetEstimatedTimetableResponse = {
	GetEstimatedTimetableResponse: {
		ServiceDeliveryInfo: {
			ResponseTimestamp: string;
			ProducerRef: string;
			RequestMessageRef: string;
		};
		Answer: {
			EstimatedTimetableDelivery: {
				ResponseTimestamp: string;
				RequestMessageRef: string;
				EstimatedJourneyVersionFrame?: EstimatedJourneyVersionFrame | EstimatedJourneyVersionFrame[];
			};
		};
	};
};

export type EstimatedJourneyVersionFrame = {
	RecordedAtTime: string;
	EstimatedVehicleJourney?: EstimatedVehicleJourney | EstimatedVehicleJourney[];
};

export type EstimatedVehicleJourney = {
	LineRef: string;
	DirectionName: string;
	FramedVehicleJourneyRef: {
		DataFrameRef: string;
	};
	VehicleRef?: string;
	EstimatedCalls: {
		EstimatedCall?: EstimatedCall | EstimatedCall[];
	};
};

export type EstimatedCall = {
	StopPointRef: string;
	Order: number;
	ExpectedArrivalTime: string;
};
