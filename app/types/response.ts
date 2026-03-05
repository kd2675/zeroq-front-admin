export type ResponseEnvelope<T> = {
  success: boolean;
  code: number | string;
  message: string;
  data: T;
};
