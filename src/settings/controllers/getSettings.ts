import express from "express";
import { Settings, ModifierSet } from "@/_global/models";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";

/**
 * GET /settings
 * Get global settings (admin only)
 */
export const getSettings = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const authUser = (req as any).user ?? (await getUserFromToken(authHeader));

    if (!authUser) {
      return next({
        statusCode: 401,
        message: "Unauthorized",
      });
    }

    // Only platform admins can access global settings
    if (authUser.role !== "platform_admin" && authUser.role !== "platform_user") {
      return next({
        statusCode: 403,
        message: "Forbidden - Only platform admins can access global settings",
      });
    }

    const settings = await Settings.findOne().lean();

    if (!settings) {
      return next({
        statusCode: 404,
        message: "Settings not found.",
      });
    }

    if (settings?.makes) {
      await Settings.updateOne(
        { _id: settings._id },
        { $unset: { makes: "" } },
      );
    }

    // Get global ModifierSet for markup values
    const globalModifierSet = await ModifierSet.findOne({ isGlobal: true }).lean();
    
    logger.info("getSettings - retrieved globalModifierSet", {
      hasGlobalModifierSet: !!globalModifierSet,
      hasStates: !!globalModifierSet?.states,
      statesType: typeof globalModifierSet?.states,
      statesIsMap: globalModifierSet?.states instanceof Map,
      statesKeys: globalModifierSet?.states ? (globalModifierSet.states instanceof Map ? Array.from(globalModifierSet.states.keys()) : Object.keys(globalModifierSet.states)) : null,
    });

    // Convert states object/Map to array format for frontend
    let stateModifiers = [];
    try {
      if (globalModifierSet?.states) {
        let statesMap = globalModifierSet.states;
        
        logger.info("getSettings - starting state modifiers conversion", {
          statesMapType: typeof statesMap,
          statesMapIsMap: statesMap instanceof Map,
        });
        
        // If it's a Mongoose Map, convert it to a plain object first
        if (statesMap instanceof Map) {
          const plainObject: any = {};
          statesMap.forEach((value, key) => {
            plainObject[key] = value;
          });
          statesMap = plainObject;
        }
        
        // Log the raw states data for debugging
        const sampleKey = statesMap instanceof Map 
          ? (statesMap.size > 0 ? Array.from(statesMap.keys())[0] : null)
          : (typeof statesMap === "object" && statesMap !== null && Object.keys(statesMap).length > 0 ? Object.keys(statesMap)[0] : null);
        const sampleValue = sampleKey 
          ? (statesMap instanceof Map ? statesMap.get(sampleKey) : statesMap[sampleKey])
          : null;
        
        logger.info("getSettings - processing state modifiers", {
          statesType: typeof statesMap,
          isMap: statesMap instanceof Map,
          isObject: typeof statesMap === "object" && statesMap !== null,
          statesKeys: statesMap instanceof Map ? Array.from(statesMap.keys()) : (typeof statesMap === "object" ? Object.keys(statesMap) : []),
          sampleKey,
          sampleValue,
          sampleValueString: JSON.stringify(sampleValue),
          sampleValueKeys: sampleValue && typeof sampleValue === "object" ? Object.keys(sampleValue) : null,
        });
        
        // Process as plain object (Map already converted above)
        if (typeof statesMap === "object" && statesMap !== null && !Array.isArray(statesMap)) {
          // Handle case where Map is serialized as object (most common case with .lean())
          stateModifiers = Object.entries(statesMap).map(([state, modifier]: [string, any]) => {
            // The new format has: type, direction, amount
            // Read these fields directly from the modifier object
            // Based on the console log, the structure is: { type: "Increase", direction: "Both Directions", amount: 75 }
            const type = modifier?.type;
            const direction = modifier?.direction;
            const amount = modifier?.amount;
            
            // If we have type field, use the new format
            if (type !== undefined && type !== null) {
              return {
                state,
                type: type,
                amount: (amount !== null && amount !== undefined) ? amount : 0,
                direction: direction || "Both Directions",
              };
            }
            // Legacy format: value, valueType, direction (convert to new format)
            else if (modifier?.value !== undefined) {
              const value = modifier.value ?? 0;
              return {
                state,
                type: value >= 0 ? "Increase" : "Decrease",
                amount: Math.abs(value),
                direction: modifier.direction === "inbound" ? "Inbound Only" 
                  : modifier.direction === "outbound" ? "Outbound Only"
                  : "Both Directions",
              };
            }
            // Fallback - shouldn't happen with correct data
            return {
              state,
              type: "Increase",
              amount: 0,
              direction: "Both Directions",
            };
          });
        }
        
        logger.info("getSettings - converted state modifiers", {
          stateModifiersCount: stateModifiers.length,
        });
      }
    } catch (error) {
      logger.error("getSettings - error processing state modifiers", {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Continue with empty array if there's an error
      stateModifiers = [];
    }

    const { makes, ...settingsData } = settings || {};

    const responseData = {
      ...settingsData,
      stateModifiers: stateModifiers,
    };

    logger.info("getSettings - returning settings", {
      userRole: authUser.role,
      userEmail: authUser.email,
      hasServiceLevels: !!settings.serviceLevels,
      serviceLevelsCount: settings.serviceLevels?.length || 0,
      hasGlobalModifierSet: !!globalModifierSet,
      stateModifiersCount: stateModifiers.length,
      stateModifiers: JSON.stringify(stateModifiers, null, 2),
      sampleStateModifier: stateModifiers.length > 0 ? stateModifiers[0] : null,
      sampleStateModifierFromGlobal: globalModifierSet?.states && typeof globalModifierSet.states === "object" 
        ? (Object.keys(globalModifierSet.states).length > 0 
          ? { state: Object.keys(globalModifierSet.states)[0], modifier: globalModifierSet.states[Object.keys(globalModifierSet.states)[0]] }
          : null)
        : null,
    });

    res.status(200).json(responseData);
  } catch (error) {
    logger.error("Error getting settings", {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return next({
      statusCode: 500,
      message: "There was an error getting settings.",
    });
  }
};

