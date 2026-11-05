
import { performance } from "node:perf_hooks";

export const testApi = async (req, res, next) => {
    try {
        const { method, url, headers = {}, body } = req.body;

        // 1. Validate required fields
        if (!method || !url) {
            return res.status(400).json({
                message: "HTTP method and URL are required"
            });
        }

        // 2. Validate HTTP method
        const allowedMethods = [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE"
        ];

        const requestMethod = method.toUpperCase();

        if (!allowedMethods.includes(requestMethod)) {
            return res.status(400).json({
                message: "Unsupported HTTP method"
            });
        }

        // 3. Validate URL
        let parsedUrl;

        try {
            parsedUrl = new URL(url);
        } catch {
            return res.status(400).json({
                message: "Please enter a valid URL"
            });
        }

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
            return res.status(400).json({
                message: "Only HTTP and HTTPS URLs are supported"
            });
        }

        // 4. Prepare request options
        const options = {
            method: requestMethod,
            headers
        };

        if (
            ["POST", "PUT", "PATCH"].includes(requestMethod) &&
            body !== undefined &&
            body !== ""
        ) {
            options.body =
                typeof body === "string"
                    ? body
                    : JSON.stringify(body);
        }

        // 5. Measure external API response time
        const startTime = performance.now();

        const response = await fetch(parsedUrl, options);

        // Read the response body before stopping the timer
        const responseText = await response.text();

        const responseTime = Math.round(
            performance.now() - startTime
        );

        // 6. Parse response data
        let responseData;

        try {
            responseData = JSON.parse(responseText);
        } catch {
            responseData = responseText;
        }

        // 7. Return response to frontend
        return res.status(200).json({
            status: response.status,
            statusText: response.statusText,
            responseTime,
            headers: Object.fromEntries(
                response.headers.entries()
            ),
            data: responseData,
            raw: responseText
        });

    } catch (error) {
       console.error("API Tester request error:", error);
        next(error);
    }
};
