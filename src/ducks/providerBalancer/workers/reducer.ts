import {
  ProviderCallSucceededAction,
  ProviderCallTimeoutAction,
  ProviderCallAction,
  PROVIDER_CALL,
} from '../providerCalls/types';
import { Reducer } from 'redux';
import {
  BalancerNetworkSwitchSucceededAction,
  BalancerAction,
  BALANCER,
} from '../balancerConfig/types';
import {
  WorkerKilledAction,
  WorkerProcessingAction,
  WorkerAction,
  WORKER,
  WorkerSpawnedAction,
} from '../workers/types';
import { WorkerState } from './types';
import {
  ProviderStatsAddedAction,
  PROVIDER_STATS,
  ProviderStatsAction,
} from '@src/ducks/providerBalancer/providerStats';

type WReducer = Reducer<WorkerState>;
const INITIAL_STATE: WorkerState = {};

const handleNetworkSwitch: WReducer = (
  _: WorkerState,
  { payload }: BalancerNetworkSwitchSucceededAction,
) => {
  // validation
  for (const [workerId, worker] of Object.entries(payload.workers)) {
    if (!worker.task) {
      throw Error(`Worker ${workerId} has no saga task assigned`);
    }
    if (worker.currentPayload) {
      throw Error(`Worker ${workerId} should not have an existing payload`);
    }
  }

  return payload.workers;
};

const handleWorkerKilled: WReducer = (
  state: WorkerState,
  { payload }: WorkerKilledAction,
) => {
  if (!state[payload.workerId]) {
    throw Error(`Worker ${payload.workerId} does not exist`);
  }

  const stateCopy = { ...state };
  Reflect.deleteProperty(stateCopy, payload.workerId);
  return stateCopy;
};

const handleWorkerProcessing: WReducer = (
  state: WorkerState,
  { payload: { currentPayload, workerId } }: WorkerProcessingAction,
) => {
  if (!state[workerId]) {
    throw Error(`Worker ${workerId} does not exist`);
  }

  if (state[workerId].currentPayload) {
    throw Error(`Worker ${workerId} is already processing a payload`);
  }

  return {
    ...state,
    [workerId]: { ...state[workerId], currentPayload },
  };
};

const handleWorkerSpawned: WReducer = (
  state: WorkerState,
  { payload }: WorkerSpawnedAction,
) => {
  if (state[payload.workerId]) {
    throw Error(`Worker ${payload.workerId} already exists`);
  }

  return {
    ...state,
    [payload.workerId]: {
      assignedProvider: payload.providerId,
      task: payload.task,
      currentPayload: null,
    },
  };
};

const handleProviderAdded: WReducer = (
  state,
  { payload }: ProviderStatsAddedAction,
) => {
  const stateCopy = { ...state };
  for (const [workerId, worker] of Object.entries(payload.workers)) {
    if (stateCopy[workerId]) {
      throw Error(`Worker ${workerId} already exists`);
    }

    stateCopy[workerId] = {
      assignedProvider: worker.assignedProvider,
      task: worker.task,
      currentPayload: null,
    };
  }
  return stateCopy;
};

const handleProviderCallSucceeded: WReducer = (
  state: WorkerState,
  { payload }: ProviderCallSucceededAction,
) => {
  const { providerCall: { callId } } = payload;
  const worker = Object.entries(state).find(
    ([_, { currentPayload }]) =>
      currentPayload ? currentPayload.callId === callId : false,
  );

  if (!worker) {
    throw Error(`Worker not found for a successful request`);
  }

  const [workerId, workerInst] = worker;

  return { ...state, [workerId]: { ...workerInst, currentPayload: null } };
};

const handleProviderCallTimeout: WReducer = (
  state: WorkerState,
  { payload }: ProviderCallTimeoutAction,
) => {
  const { providerCall } = payload;
  const worker = Object.entries(state).find(
    ([_, { currentPayload }]) =>
      currentPayload ? currentPayload.callId === providerCall.callId : false,
  );

  if (!worker) {
    throw Error(`Worker not found for a timed out request`);
  }

  const [workerId, workerInst] = worker;

  return { ...state, [workerId]: { ...workerInst, currentPayload: null } };
};

const workers: WReducer = (
  state: WorkerState = INITIAL_STATE,
  action:
    | WorkerAction
    | ProviderCallAction
    | BalancerAction
    | ProviderStatsAction,
): WorkerState => {
  switch (action.type) {
    case WORKER.SPAWNED:
      return handleWorkerSpawned(state, action);
    case WORKER.PROCESSING:
      return handleWorkerProcessing(state, action);
    case WORKER.KILLED:
      return handleWorkerKilled(state, action);

    case BALANCER.NETWORK_SWITCH_SUCCEEDED:
      return handleNetworkSwitch(state, action);

    case PROVIDER_CALL.SUCCEEDED:
      return handleProviderCallSucceeded(state, action);
    case PROVIDER_CALL.TIMEOUT:
      return handleProviderCallTimeout(state, action);

    case PROVIDER_STATS.ADDED:
      return handleProviderAdded(state, action);
    default:
      return state;
  }
};

export default workers;