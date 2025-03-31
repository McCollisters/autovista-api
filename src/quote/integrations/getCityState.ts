const axios = require("axios");

async function getCityState(value: string) {
  const accessToken = process.env.GMAPS_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?key=${accessToken}&address=${value}`;

  try {
    const googleResponse = await axios(url);
    if (googleResponse && googleResponse.data.results[0]) {
      let address = googleResponse.data.results[0].formatted_address;
      address = address.replace(", USA", "");

      let zip = null;
      let zipCode = address.match(/\b\d{5}\b/);

      if (zipCode && zipCode.length) {
        zip = zipCode[0];
      }

      return {
        address,
        zipCode: zip,
      };
    } else {
      return "Location not found.";
    }
  } catch (e) {
    console.log(e);
    return "Location not found.";
  }
}

module.exports = getCityState;
