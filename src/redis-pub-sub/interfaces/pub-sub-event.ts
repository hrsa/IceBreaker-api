export interface PubSubEvent<T = unknown> {
  type: string;
  data: T;
  timestamp: number;
}
