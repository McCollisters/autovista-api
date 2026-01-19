import express from "express";
import { Settings, ModifierSet } from "@/_global/models";
import { ValueType } from "@/modifierSet/schema";
import { logger } from "@/core/logger";
import { getUserFromToken } from "@/_global/utils/getUserFromToken";

/**
 * PUT /settings
 * Update settings (platform admin only)
 */
export const updateSettings = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const authUser = (req as any).user ?? (await getUserFromToken(authHeader));

    if (!authUser || authUser.role !== "platform_admin") {
      return next({
        statusCode: 401,
        message: "Unauthorized. platform_admin access required.",
      });
    }

    // Find existing settings or create new
    let settings = await Settings.findOne();

    if (!settings) {
      settings = new Settings({});
    }

    // Log incoming request for debugging
    logger.info("updateSettings - incoming request", {
      body: req.body,
      formName: req.body.formName,
      hasInoperableMarkup: req.body.inoperableMarkup !== undefined,
      inoperableMarkupValue: req.body.inoperableMarkup,
      inoperableMarkupType: typeof req.body.inoperableMarkup,
      hasHolidays: req.body.holidays !== undefined,
      holidaysValue: req.body.holidays,
      holidaysType: Array.isArray(req.body.holidays) ? req.body.holidays.map((h: any) => ({
        value: h,
        type: typeof h,
        isDate: h instanceof Date,
        hasDateProp: typeof h === "object" && h !== null && "date" in h,
      })) : typeof req.body.holidays,
    });

    // Update fields from request body
    const {
      transitTimes,
      holidays,
      quoteExpirationDays,
      serviceLevels,
      formName,
      stateModifiers,
      routes,
      // Markup fields (legacy names from frontend)
      inoperableMarkup,
      enclosedMarkup,
      enclosedModifier,
      whiteGloveModifier,
      whiteGloveMinimum,
    } = req.body;

    // Handle markup updates (stored in global ModifierSet)
    if (formName === "markup") {
      const globalModifierSet = (await (ModifierSet as any).findOne({
        isGlobal: true,
      })) as any;

      if (!globalModifierSet) {
        logger.error("Global ModifierSet not found", {
          userId: authUser._id,
          userEmail: authUser.email,
        });
        return next({
          statusCode: 404,
          message: "Global ModifierSet not found. Please ensure a global ModifierSet exists with isGlobal: true.",
        });
      }

      // Helper function to convert to number, handling empty strings and null
      const toNumber = (val: any): number => {
        if (val === null || val === undefined || val === "") return 0;
        const num = Number(val);
        return isNaN(num) ? 0 : num;
      };

      // Update markup fields (only update if field is present in request)
      // Note: Empty string should be treated as 0, so we check !== undefined
      if (inoperableMarkup !== undefined) {
        const numericValue = toNumber(inoperableMarkup);
        globalModifierSet.inoperable = {
          value: numericValue,
          valueType: ValueType.Flat,
        };
        logger.info("Updating inoperable markup", {
          received: inoperableMarkup,
          converted: numericValue,
          before: globalModifierSet.inoperable?.value,
        });
      } else {
        logger.info("inoperableMarkup not provided in request", {
          inoperableMarkup,
          isUndefined: inoperableMarkup === undefined,
          isNull: inoperableMarkup === null,
        });
      }

      if (enclosedMarkup !== undefined) {
        const numericValue = toNumber(enclosedMarkup);
        globalModifierSet.enclosedFlat = {
          value: numericValue,
          valueType: ValueType.Flat,
        };
        logger.info("Updating enclosed markup", {
          received: enclosedMarkup,
          converted: numericValue,
        });
      }

      if (enclosedModifier !== undefined) {
        const numericValue = toNumber(enclosedModifier);
        globalModifierSet.enclosedPercent = {
          value: numericValue,
          valueType: ValueType.Percentage,
        };
        logger.info("Updating enclosed modifier", {
          received: enclosedModifier,
          converted: numericValue,
        });
      }

      if (whiteGloveModifier !== undefined || whiteGloveMinimum !== undefined) {
        globalModifierSet.whiteGlove = {
          multiplier: whiteGloveModifier !== undefined && whiteGloveModifier !== null 
            ? toNumber(whiteGloveModifier) 
            : (globalModifierSet.whiteGlove?.multiplier || 2),
          minimum: whiteGloveMinimum !== undefined && whiteGloveMinimum !== null 
            ? toNumber(whiteGloveMinimum) 
            : (globalModifierSet.whiteGlove?.minimum || 1200),
        };
      }

      await globalModifierSet.save();
      
      // Verify the save by fetching the document again
      const savedModifierSet = (await (ModifierSet as any).findById(
        globalModifierSet._id,
      ).lean()) as any;
      
      logger.info(`User ${authUser.email} updated global modifierSet markups`, {
        userId: authUser._id,
        modifierSetId: globalModifierSet._id,
        inoperableMarkup: inoperableMarkup !== undefined ? toNumber(inoperableMarkup) : "not updated",
        enclosedMarkup: enclosedMarkup !== undefined ? toNumber(enclosedMarkup) : "not updated",
        enclosedModifier: enclosedModifier !== undefined ? toNumber(enclosedModifier) : "not updated",
        whiteGloveModifier: whiteGloveModifier !== undefined ? toNumber(whiteGloveModifier) : "not updated",
        whiteGloveMinimum: whiteGloveMinimum !== undefined ? toNumber(whiteGloveMinimum) : "not updated",
        savedInoperable: savedModifierSet?.inoperable?.value,
        savedEnclosedFlat: savedModifierSet?.enclosedFlat?.value,
        savedEnclosedPercent: savedModifierSet?.enclosedPercent?.value,
        savedWhiteGlove: savedModifierSet?.whiteGlove,
        verificationMatch: savedModifierSet?.inoperable?.value === (inoperableMarkup !== undefined ? toNumber(inoperableMarkup) : savedModifierSet?.inoperable?.value),
      });
    }

    // Handle state modifiers updates (stored in global ModifierSet)
    if (formName === "state") {
      const globalModifierSet = (await (ModifierSet as any).findOne({
        isGlobal: true,
      })) as any;

      if (!globalModifierSet) {
        logger.error("Global ModifierSet not found", {
          userId: authUser._id,
          userEmail: authUser.email,
        });
        return next({
          statusCode: 404,
          message: "Global ModifierSet not found. Please ensure a global ModifierSet exists with isGlobal: true.",
        });
      }

      // Convert array format to Map format
      if (stateModifiers !== undefined) {
        if (!Array.isArray(stateModifiers)) {
          logger.error("stateModifiers is not an array", { stateModifiers, type: typeof stateModifiers });
          return next({
            statusCode: 400,
            message: "State modifiers must be an array.",
          });
        }

        // Clear existing states or initialize Map
        if (!globalModifierSet.states) {
          globalModifierSet.states = new Map();
        } else {
          globalModifierSet.states.clear();
        }

        // Convert frontend array format to backend object format
        // Store as plain object (not Map) to match actual database structure
        const statesObject: any = {};
        
        for (const modifier of stateModifiers) {
          if (!modifier.state || modifier.state === "") {
            continue; // Skip empty states
          }

          const normalizedDirection =
            modifier.direction === "Outbound Only"
              ? "outbound"
              : modifier.direction === "Inbound Only"
                ? "inbound"
                : "both";

          const amountValue = Number(modifier.amount) || 0;
          const value = modifier.type === "Decrease" ? -amountValue : amountValue;

          // Store in the actual format used in the database: direction, value, valueType
          statesObject[modifier.state] = {
            direction: normalizedDirection,
            value: value,
            valueType: "flat",
          };
        }

        // Assign the object directly (Mongoose will handle it)
        globalModifierSet.states = statesObject as any;

        await globalModifierSet.save();

        const statesCount =
          globalModifierSet.states instanceof Map
            ? globalModifierSet.states.size
            : Object.keys(globalModifierSet.states || {}).length;
        logger.info(`User ${authUser.email} updated state modifiers`, {
          userId: authUser._id,
          modifierSetId: globalModifierSet._id,
          stateModifiersCount: stateModifiers.length,
          statesCount,
        });
      }
    }

    // Handle state-to-state route modifiers updates (stored in global ModifierSet)
    if (formName === "statetostate") {
      const globalModifierSet = (await (ModifierSet as any).findOne({
        isGlobal: true,
      })) as any;

      if (!globalModifierSet) {
        logger.error("Global ModifierSet not found", {
          userId: authUser._id,
          userEmail: authUser.email,
        });
        return next({
          statusCode: 404,
          message:
            "Global ModifierSet not found. Please ensure a global ModifierSet exists with isGlobal: true.",
        });
      }

      if (routes !== undefined) {
        if (!Array.isArray(routes)) {
          logger.error("routes is not an array", { routes, type: typeof routes });
          return next({
            statusCode: 400,
            message: "Routes must be an array.",
          });
        }

        globalModifierSet.routes = routes
          .filter((route: any) => route.origin && route.destination)
          .map((route: any) => ({
            origin: route.origin,
            destination: route.destination,
            value: Number(route.value) || 0,
            valueType: route.valueType || "flat",
          })) as any;

        await globalModifierSet.save();

        logger.info(`User ${authUser.email} updated route modifiers`, {
          userId: authUser._id,
          modifierSetId: globalModifierSet._id,
          routesCount: globalModifierSet.routes?.length || 0,
        });
      }
    }

    // Handle service level modifiers updates (stored in global ModifierSet)
    if (formName === "servicelevels") {
      const globalModifierSet = (await (ModifierSet as any).findOne({
        isGlobal: true,
      })) as any;

      if (!globalModifierSet) {
        logger.error("Global ModifierSet not found", {
          userId: authUser._id,
          userEmail: authUser.email,
        });
        return next({
          statusCode: 404,
          message:
            "Global ModifierSet not found. Please ensure a global ModifierSet exists with isGlobal: true.",
        });
      }

      if (serviceLevels !== undefined) {
        if (!Array.isArray(serviceLevels)) {
          logger.error("serviceLevels is not an array", {
            serviceLevels,
            type: typeof serviceLevels,
          });
          return next({
            statusCode: 400,
            message: "Service levels must be an array.",
          });
        }

        globalModifierSet.serviceLevels = serviceLevels
          .filter((level: any) => level.serviceLevelOption)
          .map((level: any) => ({
            serviceLevelOption: String(level.serviceLevelOption),
            value: Number(level.value) || 0,
          })) as any;

        await globalModifierSet.save();

        logger.info(`User ${authUser.email} updated service levels`, {
          userId: authUser._id,
          modifierSetId: globalModifierSet._id,
          serviceLevelsCount: globalModifierSet.serviceLevels?.length || 0,
        });
      }
    }

    // Handle regular settings updates
    if (transitTimes !== undefined) {
      settings.transitTimes = transitTimes;
    }

    if (holidays !== undefined) {
      // Ensure holidays is an array
      if (!Array.isArray(holidays)) {
        logger.error("holidays is not an array", { holidays, type: typeof holidays });
        return next({
          statusCode: 400,
          message: "Holidays must be an array.",
        });
      }

      // Convert dates to Date objects, handling various formats
      // Filter out null, undefined, empty strings, and invalid dates
      const processedHolidays: Date[] = [];
      
      for (let i = 0; i < holidays.length; i++) {
        const date = holidays[i];
        
        // Skip null, undefined, or empty values
        if (date === null || date === undefined || date === "") {
          logger.warn(`Skipping empty holiday at index ${i}`);
          continue;
        }
        
        let dateToConvert: any = date;
        
        // If it's an object with a date property (from DatePicker or form submission)
        if (typeof date === "object" && !(date instanceof Date) && date !== null) {
          if (date.date !== undefined && date.date !== null) {
            dateToConvert = date.date;
          } else if (date instanceof Date) {
            dateToConvert = date;
          }
        }
        
        // Convert to Date object
        let convertedDate: Date;
        try {
          if (dateToConvert instanceof Date) {
            convertedDate = dateToConvert;
          } else if (typeof dateToConvert === "string") {
            // Handle ISO strings and other date string formats
            convertedDate = new Date(dateToConvert);
          } else if (typeof dateToConvert === "number") {
            convertedDate = new Date(dateToConvert);
          } else {
            // Try to convert whatever it is
            convertedDate = new Date(dateToConvert);
          }
          
          // Validate the date
          if (isNaN(convertedDate.getTime())) {
            logger.warn("Invalid date format in holidays array", {
              index: i,
              originalValue: date,
              convertedValue: dateToConvert,
            });
            throw new Error(`Invalid date format at index ${i}: ${JSON.stringify(date)}`);
          }
          
          processedHolidays.push(convertedDate);
        } catch (error) {
          logger.error("Error processing holiday date", {
            index: i,
            date,
            error: error instanceof Error ? error.message : error,
          });
          return next({
            statusCode: 400,
            message: `Invalid date format at index ${i}: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }
      
      // Sort holidays chronologically before saving
      processedHolidays.sort((a, b) => a.getTime() - b.getTime());
      
      settings.holidays = processedHolidays;
      
      logger.info("Processed holidays", {
        count: settings.holidays.length,
        holidays: settings.holidays.map((d: Date) => d.toISOString()),
      });
    }

    if (quoteExpirationDays !== undefined) {
      settings.quoteExpirationDays = quoteExpirationDays;
    }

    if (serviceLevels !== undefined && formName !== "servicelevels") {
      settings.serviceLevels = serviceLevels;
    }

    // Update the updatedAt timestamp
    settings.updatedAt = new Date();

    await settings.save();
    await Settings.updateOne(
      { _id: settings._id },
      { $unset: { makes: "" } },
    );

    logger.info(`User ${authUser.email} updated settings`, {
      userId: authUser._id,
      updatedFields: Object.keys(req.body),
      formName: formName,
    });

    // Get updated global ModifierSet for response (always fetch to include in response)
    const updatedGlobalModifierSet = (await (ModifierSet as any).findOne({
      isGlobal: true,
    }).lean()) as any;

    // Convert states object/Map to array format for frontend
    let stateModifiersArray: Array<any> = [];
    if (updatedGlobalModifierSet?.states) {
      const statesMap = updatedGlobalModifierSet.states;
      if (statesMap instanceof Map) {
        stateModifiersArray = Array.from(statesMap.entries()).map(([state, modifier]) => {
          // Handle actual format: type, direction, amount
          if (modifier?.type && modifier?.amount !== undefined) {
            return {
              state,
              type: modifier.type || "Increase",
              amount: modifier.amount ?? 0,
              direction: modifier.direction || "Both Directions",
            };
          } else if (modifier?.value !== undefined) {
            // Legacy format
            const value = modifier?.value ?? 0;
            return {
              state,
              type: value >= 0 ? "Increase" : "Decrease",
              amount: Math.abs(value),
              direction: modifier?.direction === "inbound" ? "Inbound Only" 
                : modifier?.direction === "outbound" ? "Outbound Only"
                : "Both Directions",
            };
          } else {
            return {
              state,
              type: "Increase",
              amount: 0,
              direction: "Both Directions",
            };
          }
        });
      } else if (typeof statesMap === "object" && statesMap !== null) {
        stateModifiersArray = Object.entries(statesMap).map(([state, modifier]: [string, any]) => {
          // Handle actual format: type, direction, amount
          if (modifier?.type && modifier?.amount !== undefined) {
            return {
              state,
              type: modifier.type || "Increase",
              amount: modifier.amount ?? 0,
              direction: modifier.direction || "Both Directions",
            };
          } else if (modifier?.value !== undefined) {
            // Legacy format
            const value = modifier?.value ?? 0;
            return {
              state,
              type: value >= 0 ? "Increase" : "Decrease",
              amount: Math.abs(value),
              direction: modifier?.direction === "inbound" ? "Inbound Only" 
                : modifier?.direction === "outbound" ? "Outbound Only"
                : "Both Directions",
            };
          } else {
            return {
              state,
              type: "Increase",
              amount: 0,
              direction: "Both Directions",
            };
          }
        });
      }
    }

    const { makes, ...settingsData } = settings.toObject() as any;

    const responseData = {
      ...settingsData,
      stateModifiers: stateModifiersArray,
    };

    res.status(200).json(responseData);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = error instanceof Error && (error as any).errors 
      ? Object.keys((error as any).errors).map(key => ({
          field: key,
          message: (error as any).errors[key].message,
        }))
      : null;

    logger.error("Error updating settings", {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      errorDetails: errorDetails,
      formName: req.body.formName,
    });

    return next({
      statusCode: 500,
      message: errorDetails 
        ? `Validation error: ${errorDetails.map(e => `${e.field}: ${e.message}`).join(", ")}`
        : `There was an error updating settings: ${errorMessage}`,
    });
  }
};

