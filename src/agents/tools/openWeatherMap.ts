import {z} from "zod";

import {
    tool,
} from "@langchain/core/tools";
import type {
    StructuredToolInterface,
} from "@langchain/core/tools";

import {
    OpenWeatherAPI,
    type CurrentWeather,
} from "openweather-api-node";

/**
 * Format weather information for presentation.
 * @param locationName - Location being described.
 * @param observation - Weather payload from API.
 * @returns Human readable description.
 */
function formatWeatherInfo(
    locationName: string,
    observation: CurrentWeather,
): string {
    const {dt, weather} = observation;
    const {description, temp, feelsLike, humidity, wind, rain, clouds} = weather;

    return [
        `In ${locationName}, the latest report of weather is as follows:`,
        `Datetime: ${dt}`,
        `Description: ${description}`,
        `Wind speed: ${wind.speed} m/s, direction: ${wind.deg}°`,
        `Humidity: ${humidity}%`,
        "Temperature:",
        `- Current: ${temp.cur}°C`,
        `- Feels like: ${feelsLike.cur}°C`,
        `Rain: ${rain}`,
        `Cloud cover: ${clouds}%`,
    ].join("\n");
}

/**
 * Normalize a location using OpenWeather lookup.
 * @param apiKey - API key.
 * @param locationName - Provided location.
 * @returns Normalized location string.
 */
async function normalizeLocation(
    apiKey: string,
    locationName: string,
): Promise<string> {
    const client = new OpenWeatherAPI({
        key: apiKey,
    });
    const locationData = await client.getLocation({locationName});
    return locationData?.name ?? locationName;
}

/**
 * Create an OpenWeatherMap-powered structured tool.
 * @param apiKey - API key.
 * @returns Configured tool when possible.
 */
export function createOpenWeatherMapTool(
    apiKey?: string,
): StructuredToolInterface | null {
    if (!apiKey) {
        return null;
    }

    return tool(
        async ({location}: { location?: string | null }) => {
            console.info("[tool] open_weather", {location});
            try {
                const normalizedLocation = await normalizeLocation(
                    apiKey,
                    location ?? "Taipei",
                );
                const client = new OpenWeatherAPI({
                    key: apiKey,
                    units: "metric",
                    locationName: normalizedLocation,
                });
                const observation = await client.getCurrent();
                return formatWeatherInfo(normalizedLocation, observation);
            } catch (error) {
                console.error("Error fetching weather data:", error);
                return "Error fetching weather data.";
            }
        },
        {
            name: "open_weather",
            description: "Fetch current weather information for a location.",
            schema: z.object({
                location: z
                    .string()
                    .min(1)
                    .describe("City or location name.")
                    .nullable()
                    .default("Taipei"),
            }),
        },
    );
}
