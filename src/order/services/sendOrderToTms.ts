import { authenticateSuperDispatch } from "../../_global/integrations/authenticateSuperDispatch";
import { IOrder } from "../schema";
import { formatOrderForTms } from "./formatOrderForTms";

export const sendOrderToTms = async (order: IOrder) => {
  try {
    const superDispatchToken = await authenticateSuperDispatch();

    console.log(superDispatchToken);

    const url = "https://api.shipper.superdispatch.com/v1/public/orders";

    const formattedBody = await formatOrderForTms(order);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${superDispatchToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formattedBody),
    });

    if (!response.ok) {
      const errorBody = await response.text(); // or
      console.error(`HTTP error ${response.status}: ${response.statusText}`);
      console.error(`Response body: ${errorBody}`);
    } else {
      const data = await response.json();
      console.log("Success:", data);
    }
  } catch (err) {
    console.error("Fetch failed:", err.message);
  }
};
