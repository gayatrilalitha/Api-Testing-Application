
export const validateRequest = (requiredFields = []) => {
    return (req, res, next) => {
        const data = req.body ?? {};

        const missingFields = requiredFields.filter((field) => {
            const value = data[field];

            return (
                value === undefined ||
                value === null ||
                (typeof value === "string" && value.trim() === "")
            );
        });

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Required fields are missing",
                missingFields
            });
        }

        next();
    };
};
