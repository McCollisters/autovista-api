export function isValidZipCode(zipCode: string): boolean {
    const zipCodePattern = /^\d{5}$/;
    return zipCodePattern.test(zipCode);
  }
  
export function getZipFromString(str: string): string[] | null {
    return str.match(/\d+/g) || null;
}

export function removeZipFromString(str: string): string {
    return str.replace(/\d/g, "");
}