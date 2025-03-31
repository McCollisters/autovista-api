export async function authenticateSuperDispatch(): Promise<string> {
    const url = "https://api.shipper.superdispatch.com/oauth/token";
    const authHeader = "Basic " + Buffer.from(`${process.env.SD_USER}:${process.env.SD_PASS}`).toString("base64");
  
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
      });
  
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
  
      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error("Error authenticating with Super Dispatch:", error);
      throw error;
    }
  }