
export const errorMiddleware = (err, req, res, next) => {
    console.error("Error:", err.message);

    // If the response has already been sent, delegate to Express
    if (res.headersSent) {
        return next(err);
    }

    const statusCode = err.status || err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        message:
            statusCode >= 500
                ? "Internal server error"
                : err.message || "Something went wrong"
    });
};
