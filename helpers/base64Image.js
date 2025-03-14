const fs = require("fs");
const path = require("path");

const handleBase64Image = async (req, res, next) => {
    if (req.body.croppedImage) {
        const base64Data = req.body.croppedImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        const filename = `${Date.now()}.png`;
        const filePath = path.join(__dirname, "../public/uploads", filename);

        fs.writeFile(filePath, buffer, (err) => {
            if (err) {
                console.error("Error saving image:", err);
                return res.status(500).json({ success: false, message: "Error processing image" });
            }
            req.file = { filename, path: filePath }; // Mock Multer req.file
            next();
        });
    } else {
        next();
    }
};

module.exports = handleBase64Image;
