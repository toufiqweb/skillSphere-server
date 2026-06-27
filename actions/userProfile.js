const { ObjectId } = require("mongodb");

const updateUserProfile = (usersCollection) => async (req, res) => {
  try {
    const rawUserId = req.headers["x-user-id"] || req.headers["userid"];
    if (!rawUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Missing user ID.",
      });
    }

    const userId = new ObjectId(rawUserId);
    const { name, profileImage, bio, skills, socialLinks, phoneNumber } = req.body;

    const filter = { _id: userId };
    const updateDoc = {
      $set: {
        ...(name && { name }),
        ...(profileImage && { image: profileImage }),
        ...(bio !== undefined && { bio }),
        ...(skills !== undefined && { skills }),
        ...(socialLinks !== undefined && { socialLinks }),
        ...(phoneNumber !== undefined && { phoneNumber }),
        updatedAt: new Date(),
      },
    };

    await usersCollection.updateOne(filter, updateDoc);

    return res.status(200).json({
      success: true,
      message: "Profile synchronized and updated successfully!",
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    });
  }
};

module.exports = {
  updateUserProfile,
};
