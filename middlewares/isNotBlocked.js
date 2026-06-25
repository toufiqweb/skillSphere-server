const { ObjectId } = require("mongodb");

const isNotBlocked = (usersCollection) => async (req, res, next) => {
  try {
    // Check multiple possible headers or body paths for the user ID
    // 1. headers["x-instructor-id"] (used in some course actions)
    // 2. headers["x-user-id"] (standard for auth middleware)
    // 3. body.instructorId
    // 4. body.instructor.instructorId (from createCourse)
    
    let userId = 
      req.headers["x-instructor-id"] || 
      req.headers["instructorid"] || 
      req.headers["x-user-id"] || 
      req.headers["userid"] || 
      req.body?.instructor?.instructorId || 
      req.body?.instructorId || 
      req.query?.instructorId;

    if (!userId) {
      // If we don't know who is making the request, let the downstream handler deal with it
      // Or we can block. The downstream handler (like createCourse) checks headers itself.
      return next();
    }

    // Lookup user in the database
    let query = { id: parseInt(userId, 10) };
    let user = await usersCollection.findOne(query);

    if (!user && ObjectId.isValid(userId)) {
      query = { _id: new ObjectId(userId) };
      user = await usersCollection.findOne(query);
    }

    if (user && user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked. You cannot create, edit, or delete courses.",
      });
    }

    next();
  } catch (error) {
    console.error("isNotBlocked Middleware Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during block status check.",
      error: error.message,
    });
  }
};

module.exports = { isNotBlocked };
