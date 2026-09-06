export const APPLICATION_LIFECYCLE = Symbol('APPLICATION_LIFECYCLE');

export interface ApplicationLifecycle {
  isInitialized(): boolean;
}
