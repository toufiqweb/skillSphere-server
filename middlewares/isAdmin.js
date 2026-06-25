const { ObjectId } = require("mongodb");

const isAdmin = (usersCollection) => async (req, res, next) => {
  try {
    // We expect the frontend to pass the user ID in a custom header (e.g., x-user-id)
    // or as a Bearer token if using a custom JWT logic. Here we use x-user-id for simplicity
    // based on the established pattern in other routes (like x-instructor-id).
    const userId = req.headers["x-user-id"] || req.headers["userid"];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Missing user ID.",
      });
    }

    // Lookup user in the database
    let query = { id: parseInt(userId, 10) };
    let user = await usersCollection.findOne(query);

    if (!user && ObjectId.isValid(userId)) {
      query = { _id: new ObjectId(userId) };
      user = await usersCollection.findOne(query);
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Verify admin role
    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admins only.",
      });
    }

    // Attach user to request for downstream handlers
    req.user = user;
    next();
  } catch (error) {
    console.error("isAdmin Middleware Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during authentication.",
      error: error.message,
    });
  }
};

module.exports = { isAdmin };
