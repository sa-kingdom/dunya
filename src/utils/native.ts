// The simple toolbox for Node.js

/**
 * Get POSIX Timestamp (second)
 */
export function getPosixTimestamp(): number {
    return Math.floor(new Date().getTime() / 1000);
}

/**
 * Shortcut for hasOwnProperty with safe.
 */
export function isObjectPropExists(srcObject: object, propName: string): boolean {
    return Object.prototype.hasOwnProperty.call(srcObject, propName);
}

/**
 * Converts a string from camelCase to snake_case.
 */
export function camelToSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) =>
        `_${letter.toLowerCase()}`,
    );
}
