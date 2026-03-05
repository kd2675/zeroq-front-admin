export type LoginRequest = {
  username: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  expiresIn?: number;
};

export type ManagerSignUpRequest = {
  username: string;
  password: string;
  email: string;
  role: "MANAGER";
  signupSecret: string;
};

export type AuthUser = {
  username?: string;
  userId?: number;
  role?: string;
  exp?: number;
};
