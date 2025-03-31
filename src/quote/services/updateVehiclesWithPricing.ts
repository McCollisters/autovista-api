
import { VehicleClass } from "../../_global/enums";
import { IVehicle } from "../../_global/interfaces"; 
import { getTMSBaseRate } from "../integrations/getTMSBaseRate";

const getVehiclePrice = async (vehicle: Partial<IVehicle>, origin: string, destination: string): Promise<any> => {
    const base = await getTMSBaseRate(vehicle, origin, destination);
   
    return {
        base,
        globalMarkups: {
            inoperable: 150,
            oversize: 120,
        },
        portalMarkups: {
            commission: 100,
            companyTariff: 350,
        },
    };
};

export const updateVehiclesWithPricing = async (vehicles: Array<Partial<IVehicle>>, origin: string, destination: string): Promise<IVehicle[]> => {

    const updatedVehicles: IVehicle[] = [];

    for (const vehicle of vehicles) {
        const pricing = await getVehiclePrice(vehicle, origin, destination);
        updatedVehicles.push({
            make: vehicle.make || "Unknown",
            model: vehicle.model || "Unknown",
            isOperable: vehicle.isOperable ?? true,
            pricing,
            class: vehicle.class || VehicleClass.Sedan
        });
    }
    return updatedVehicles;
};
