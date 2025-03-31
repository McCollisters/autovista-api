
import { IVehicle } from "../../_global/interfaces"; 

const getVehiclePricing = (vehicle: Partial<IVehicle>): any => {
    return {
        base: 1250 ?? 0,
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

export const calculateVehiclePricing = async (vehicles: Array<Partial<IVehicle>>): Promise<IVehicle[]> => {
    const updatedVehicles: IVehicle[] = [];

    for (const vehicle of vehicles) {
        const pricing = await getVehiclePricing(vehicle);
        updatedVehicles.push({
            make: vehicle.make || "Unknown",
            model: vehicle.model || "Unknown",
            isOperable: vehicle.isOperable ?? true,
            pricing,
        });
    }
    return updatedVehicles;
};
