export const isCanadianPostcode = (value: string) => {
    try {
      var regex = /[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d/;
      var match = regex.exec(value);
      if (match) {
        if (
          (value.indexOf("-") !== -1 || value.indexOf(" ") !== -1) &&
          value.length == 7
        ) {
          return true;
        } else if (
          (value.indexOf("-") == -1 || value.indexOf(" ") == -1) &&
          value.length == 6
        ) {
          return true;
        }
      } else {
        let provinces = [
          "Canada",
          ", PE",
          ", QC",
          ", MB",
          ", ON",
          ", SK",
          ", AB",
          ", BC",
          ", NB",
          " ,NL",
          ", NS",
        ];
  
        let isCanada = false;
  
        provinces.forEach((abbrev) => {
          if (value?.includes(abbrev)) {
            isCanada = true;
          }
        });
  
        return isCanada;
      }
    } catch (err) {
      console.log(err);
    }
}
  
  