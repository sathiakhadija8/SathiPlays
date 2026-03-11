export declare function useTravelStore(): {
  trips: any[];
  dreamDestinations: any[];
  plannerData: Record<string, any>;
  isLoaded: boolean;
  error: string;
  load: () => Promise<void>;
  addTrip: (payload: any) => Promise<string>;
  updateTrip: (trip: any) => Promise<void>;
  deleteTrip: (tripId: string) => Promise<void>;
  addDream: (payload: any) => Promise<string>;
  updateDream: (dream: any) => Promise<void>;
  moveDreamToTrip: (dreamId: string) => Promise<string>;
  updatePlanner: (tripId: string, planner: any) => Promise<void>;
  deleteTripImage: (tripId: string, imageUrl: string) => Promise<void>;
};
