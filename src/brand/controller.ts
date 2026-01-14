import express from "express";
import { Brand } from "@/_global/models";
import { VehicleClass } from "@/_global/enums";
import { logger } from "@/core/logger";

const validPricingClasses = new Set(Object.values(VehicleClass));

const isPricingClassValid = (pricingClass: string): boolean =>
  validPricingClasses.has(pricingClass as VehicleClass);

export const createBrand = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const savedBrand = await new Brand({ brand: "Ford" }).save();
    res.send(savedBrand);
  } catch (error) {
    logger.error("Error creating brand", {
      error: error instanceof Error ? error.message : error,
    });
    return next({
      statusCode: 500,
      message: "There was an error creating the brand.",
    });
  }
};

export const updateBrand = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { brandId } = req.params;
    const { make, models } = req.body || {};

    if (!make || !Array.isArray(models)) {
      return next({
        statusCode: 400,
        message: "Make and models are required.",
      });
    }

    const invalidPricingClass = models.find(
      (model: { pricingClass?: string }) =>
        model?.pricingClass && !isPricingClassValid(model.pricingClass),
    );

    if (invalidPricingClass) {
      return next({
        statusCode: 400,
        message: "Invalid pricing class provided.",
      });
    }

    const updatedBrand = await Brand.findByIdAndUpdate(
      brandId,
      { make, models },
      { new: true },
    );

    if (!updatedBrand) {
      return next({
        statusCode: 404,
        message: "Brand not found.",
      });
    }

    res.status(200).json(updatedBrand);
  } catch (error) {
    logger.error("Error updating brand", {
      error: error instanceof Error ? error.message : error,
    });
    return next({
      statusCode: 500,
      message: "There was an error updating the brand.",
    });
  }
};

export const deleteBrand = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): Promise<void> => {
  try {
    const { brandId } = req.params;
    const deletedBrand = await Brand.findByIdAndDelete(brandId);

    if (!deletedBrand) {
      return next({
        statusCode: 404,
        message: "Brand not found.",
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error("Error deleting brand", {
      error: error instanceof Error ? error.message : error,
    });
    return next({
      statusCode: 500,
      message: "There was an error deleting the brand.",
    });
  }
};
