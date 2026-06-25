const { ObjectId } = require("mongodb");

// Identify the Super Admin by a well-known email stored in environment variable
// Fallback: also check `isSuperAdmin: true` flag on the user document
const isSuperAdmin = (user) => {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  return user?.isSuperAdmin === true || (superAdminEmail && user?.email === superAdminEmail);
};

// Helper to strip sensitive fields and stamp the isSuperAdmin flag before sending to frontend
const sanitizeUser = (user) => {
  const { password, ...rest } = user;
  return {
    ...rest,
    // Always stamp so the frontend can rely on this field without knowing the email
    isSuperAdmin: isSuperAdmin(user),
  };
};


// GET /api/admin/users
const getAllUsers = (usersCollection) => async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search || "";
    const roleFilter = req.query.role || "";        // "student" | "instructor" | "admin" | "all" | ""
    const blockFilter = req.query.blocked || "";    // "true" | "false" | "" (all)

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (roleFilter && roleFilter.toLowerCase() !== "all") {
      query.role = roleFilter.toLowerCase();
    }

    if (blockFilter === "true") {
      query.isBlocked = true;
    } else if (blockFilter === "false") {
      query.isBlocked = { $ne: true };
    }

    const skip = (page - 1) * limit;
    const totalUsers = await usersCollection.countDocuments(query);

    const users = await usersCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    res.status(200).json({
      success: true,
      message: "Users fetched successfully.",
      data: users.map(sanitizeUser),
      meta: {
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit) || 1,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching users.",
      error: error.message,
    });
  }
};

// PATCH /api/admin/users/:id/role
const updateUserRole = (usersCollection) => async (req, res) => {
  try {
    const id = req.params.id;
    const { role } = req.body;

    const validRoles = ["student", "instructor", "admin"];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(", ")}.`,
      });
    }

    // Resolve user by ObjectId or numeric id
    let query = { id: parseInt(id, 10) };
    let targetUser = await usersCollection.findOne(query);
    if (!targetUser && ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
      targetUser = await usersCollection.findOne(query);
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Super Admin protection
    if (isSuperAdmin(targetUser)) {
      return res.status(403).json({
        success: false,
        message: "The Super Admin role cannot be changed.",
      });
    }

    await usersCollection.updateOne(query, {
      $set: { role, updatedAt: new Date() },
    });

    res.status(200).json({
      success: true,
      message: `User role updated to '${role}' successfully.`,
      role,
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the user role.",
      error: error.message,
    });
  }
};

// PATCH /api/admin/users/:id/block
const toggleUserBlock = (usersCollection) => async (req, res) => {
  try {
    const id = req.params.id;

    // Resolve user
    let query = { id: parseInt(id, 10) };
    let targetUser = await usersCollection.findOne(query);
    if (!targetUser && ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
      targetUser = await usersCollection.findOne(query);
    }

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Super Admin protection — absolute block
    if (isSuperAdmin(targetUser)) {
      return res.status(403).json({
        success: false,
        message: "The Super Admin account cannot be blocked.",
      });
    }

    const newBlockedStatus = !targetUser.isBlocked;

    await usersCollection.updateOne(query, {
      $set: {
        isBlocked: newBlockedStatus,
        // If instructor is blocked, mark them as read-only
        ...(targetUser.role === "instructor" ? { isReadOnly: newBlockedStatus } : {}),
        updatedAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: `User has been ${newBlockedStatus ? "blocked" : "unblocked"} successfully.`,
      isBlocked: newBlockedStatus,
    });
  } catch (error) {
    console.error("Error toggling user block status:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while updating the user's block status.",
      error: error.message,
    });
  }
};

module.exports = { getAllUsers, updateUserRole, toggleUserBlock };
