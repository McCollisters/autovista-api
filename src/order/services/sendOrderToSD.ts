import { authenticateSuperDispatch } from "../../_global/integrations/authenticateSuperDispatch";
import { IOrder } from "@/_global/models";
import { formatOrderForSD } from "./formatOrderForSD";

export const sendOrderToSD = async (order: IOrder) => {
  try {
    const superDispatchToken = await authenticateSuperDispatch();

    const url = "https://api.shipper.superdispatch.com/v1/public/orders";

    const formattedBody = await formatOrderForSD(order);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${superDispatchToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formattedBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();

      const error = new Error(
        `HTTP error ${response.status}: ${response.statusText} - ${errorBody}`,
      );
      (error as any).status = response.status;
      throw error;
    } else {
      return await response.json();
    }
  } catch (err) {
    throw err;
  }
};
