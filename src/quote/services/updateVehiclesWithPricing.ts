
import { VehicleClass } from "../../_global/enums";
import { IVehicle } from "../../_global/interfaces";
import { IRule } from "../../rule/schema"; 
import { getTMSBaseRate } from "../integrations/getTMSBaseRate";
import { getGlobalModifiers } from "../../_global/services/getGlobalModifiers";
import { getPortalModifiers } from "../../_global/services/getPortalModifiers";

interface VehiclePriceParams {
    vehicle: Partial<IVehicle>; 
    origin: string;
    destination: string;
    globalModifiers: Array<IRule>; 
    portalModifiers: Array<IRule>; 
  }

const getVehiclePrice = async (params: VehiclePriceParams): Promise<any> => {

    const { vehicle, origin, destination, globalModifiers, portalModifiers } = params;

    console.log(globalModifiers, portalModifiers)

    // 
    const base = await getTMSBaseRate(vehicle, origin, destination);

    return {
        base,
        globalModifiers: {
            inoperable: 150,
            oversize: 120,
            discount: 0
        },
        portalModifiers: {
            commission: 100,
            companyTariff: 350,
            discount: -75
        },
    };
};


export const updateVehiclesWithPricing = async (portalId: string, vehicles: Array<Partial<IVehicle>>, origin: string, destination: string): Promise<IVehicle[]> => {

    const g_Modifiers = await getGlobalModifiers()
    const p_Modifiers = await getPortalModifiers(portalId);
   
    const updatedVehicles: IVehicle[] = [];

    for (const vehicle of vehicles) {
        const pricing = await getVehiclePrice({ vehicle, origin, destination, globalModifiers: g_Modifiers, portalModifiers: p_Modifiers });
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
