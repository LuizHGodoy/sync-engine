import { QueueItem, ConflictResolutionStrategy } from "./types";

export class ConflictResolver {
  private strategy: ConflictResolutionStrategy;

  constructor(strategy: ConflictResolutionStrategy) {
    this.strategy = strategy;
  }

  async resolve(localItem: QueueItem, serverItem: any): Promise<QueueItem> {
    try {
      return await this.strategy.resolve(localItem, serverItem);
    } catch (error) {
      throw new Error(`Error resolving conflict: ${error}`);
    }
  }

  setStrategy(strategy: ConflictResolutionStrategy): void {
    this.strategy = strategy;
  }

  getStrategy(): ConflictResolutionStrategy {
    return this.strategy;
  }
}

export const ConflictStrategies = {
  clientWins: (): ConflictResolutionStrategy => ({
    name: "client-wins",
    resolve: async (
      localItem: QueueItem,
      _serverItem: any
    ): Promise<QueueItem> => {
      return {
        ...localItem,
        updatedAt: Date.now(),
      };
    },
  }),

  serverWins: (): ConflictResolutionStrategy => ({
    name: "server-wins",
    resolve: async (
      localItem: QueueItem,
      serverItem: any
    ): Promise<QueueItem> => {
      return {
        ...localItem,
        payload: serverItem,
        updatedAt: Date.now(),
      };
    },
  }),

  timestampWins: (): ConflictResolutionStrategy => ({
    name: "timestamp-wins",
    resolve: async (
      localItem: QueueItem,
      serverItem: any
    ): Promise<QueueItem> => {
      const serverTimestamp = serverItem.updatedAt || serverItem.timestamp || 0;
      const localTimestamp = localItem.updatedAt;

      if (localTimestamp >= serverTimestamp) {
        return {
          ...localItem,
          updatedAt: Date.now(),
        };
      } else {
        return {
          ...localItem,
          payload: serverItem,
          updatedAt: Date.now(),
        };
      }
    },
  }),

  merge: (): ConflictResolutionStrategy => ({
    name: "merge",
    resolve: async (
      localItem: QueueItem,
      serverItem: any
    ): Promise<QueueItem> => {
      let mergedPayload: any;

      if (
        typeof localItem.payload === "object" &&
        typeof serverItem === "object"
      ) {
        mergedPayload = {
          ...serverItem,
          ...localItem.payload,
        };
      } else {
        mergedPayload = localItem.payload;
      }

      return {
        ...localItem,
        payload: mergedPayload,
        updatedAt: Date.now(),
      };
    },
  }),

  smartMerge: (
    clientFields: string[] = ["id", "createdAt"]
  ): ConflictResolutionStrategy => ({
    name: "smart-merge",
    resolve: async (
      localItem: QueueItem,
      serverItem: any
    ): Promise<QueueItem> => {
      let mergedPayload: any;

      if (
        typeof localItem.payload === "object" &&
        typeof serverItem === "object"
      ) {
        mergedPayload = { ...serverItem };

        clientFields.forEach((field) => {
          if (localItem.payload[field] !== undefined) {
            mergedPayload[field] = localItem.payload[field];
          }
        });
      } else {
        mergedPayload = localItem.payload;
      }

      return {
        ...localItem,
        payload: mergedPayload,
        updatedAt: Date.now(),
      };
    },
  }),

  versionBased: (): ConflictResolutionStrategy => ({
    name: "version-based",
    resolve: async (
      localItem: QueueItem,
      serverItem: any
    ): Promise<QueueItem> => {
      const localVersion = localItem.payload.version || 0;
      const serverVersion = serverItem.version || 0;

      if (localVersion > serverVersion) {
        return {
          ...localItem,
          payload: {
            ...localItem.payload,
            version: localVersion + 1,
          },
          updatedAt: Date.now(),
        };
      } else {
        return {
          ...localItem,
          payload: {
            ...serverItem,
            version: serverVersion + 1,
          },
          updatedAt: Date.now(),
        };
      }
    },
  }),

  custom: (
    resolveFn: (localItem: QueueItem, serverItem: any) => Promise<QueueItem>
  ): ConflictResolutionStrategy => ({
    name: "custom",
    resolve: resolveFn,
  }),

  manual: (): ConflictResolutionStrategy => ({
    name: "manual",
    resolve: async (
      localItem: QueueItem,
      serverItem: any
    ): Promise<QueueItem> => {
      throw new Error(
        `Conflict requires manual resolution for item ${localItem.id}`
      );
    },
  }),

  keepBoth: (): ConflictResolutionStrategy => ({
    name: "keep-both",
    resolve: async (
      localItem: QueueItem,
      serverItem: any
    ): Promise<QueueItem> => {
      return {
        ...localItem,
        payload: {
          ...localItem.payload,
          conflictData: {
            hasServerVersion: true,
            serverVersion: serverItem,
            conflictResolvedAt: Date.now(),
          },
        },
        updatedAt: Date.now(),
      };
    },
  }),
};

export const ConflictUtils = {
  hasSignificantChanges: (
    localItem: QueueItem,
    serverItem: any,
    ignoredFields: string[] = ["updatedAt", "timestamp"]
  ): boolean => {
    if (
      typeof localItem.payload !== "object" ||
      typeof serverItem !== "object"
    ) {
      return JSON.stringify(localItem.payload) !== JSON.stringify(serverItem);
    }

    const localCopy = { ...localItem.payload };
    const serverCopy = { ...serverItem };

    ignoredFields.forEach((field) => {
      delete localCopy[field];
      delete serverCopy[field];
    });

    return JSON.stringify(localCopy) !== JSON.stringify(serverCopy);
  },

  identifyConflictType: (
    localItem: QueueItem,
    serverItem: any
  ): "version" | "concurrent" | "deleted" | "field" => {
    if (!serverItem) {
      return "deleted";
    }

    const localVersion = localItem.payload.version;
    const serverVersion = serverItem.version;

    if (localVersion && serverVersion && localVersion !== serverVersion) {
      return "version";
    }

    const localTimestamp = localItem.updatedAt;
    const serverTimestamp = serverItem.updatedAt || serverItem.timestamp;

    if (Math.abs(localTimestamp - serverTimestamp) < 5000) {
      return "concurrent";
    }

    return "field";
  },

  createDiffReport: (
    localItem: QueueItem,
    serverItem: any
  ): {
    changedFields: string[];
    onlyInLocal: string[];
    onlyInServer: string[];
  } => {
    const report = {
      changedFields: [] as string[],
      onlyInLocal: [] as string[],
      onlyInServer: [] as string[],
    };

    if (
      typeof localItem.payload !== "object" ||
      typeof serverItem !== "object"
    ) {
      return report;
    }

    const localKeys = Object.keys(localItem.payload);
    const serverKeys = Object.keys(serverItem);
    const allKeys = new Set([...localKeys, ...serverKeys]);

    allKeys.forEach((key) => {
      const localValue = localItem.payload[key];
      const serverValue = serverItem[key];

      if (localValue === undefined) {
        report.onlyInServer.push(key);
      } else if (serverValue === undefined) {
        report.onlyInLocal.push(key);
      } else if (JSON.stringify(localValue) !== JSON.stringify(serverValue)) {
        report.changedFields.push(key);
      }
    });

    return report;
  },
};
