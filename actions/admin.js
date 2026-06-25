const { ObjectId } = require("mongodb");

// GET /api/admin/courses/pending
const getPendingCourses = (coursesCollection) => async (req, res) => {
  try {
    // Only pending courses
    const query = { status: "pending" };

    const pendingCourses = await coursesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      message: "Pending courses fetched successfully.",
      data: pendingCourses,
    });
  } catch (error) {
    console.error("Error fetching pending courses:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching pending courses.",
      error: error.message,
    });
  }
};

// GET /api/admin/courses
const getAllCoursesForAdmin = (coursesCollection) => async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 12;
    const search = req.query.search || "";
    const status = req.query.status || ""; // Admin can filter by status
    const sort = req.query.sort || "";

    const query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (status && status.toLowerCase() !== "all") {
      query.status = status.toLowerCase();
    }

    let sortOption = {};
    if (sort === "price-low") sortOption = { price: 1 };
    else if (sort === "price-high") sortOption = { price: -1 };
    else sortOption = { createdAt: -1 };

    const skip = (page - 1) * limit;

    const totalCourses = await coursesCollection.countDocuments(query);
    const result = await coursesCollection
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .toArray();

    res.status(200).json({
      success: true,
      message: "All courses fetched successfully for admin.",
      data: result,
      meta: {
        totalCourses,
        totalPages: Math.ceil(totalCourses / limit) || 1,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching all courses for admin:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching courses.",
      error: error.message,
    });
  }
};

// PATCH /api/admin/courses/:id/approval
const approveOrRejectCourse = (coursesCollection) => async (req, res) => {
  try {
    const id = req.params.id;
    const { action } = req.body;

    if (
      !action ||
      !["approve", "reject", "unpublish", "publish"].includes(action)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid action. Must be 'approve', 'reject', 'unpublish', or 'publish'.",
      });
    }

    let query = { id: parseInt(id, 10) };
    let course = await coursesCollection.findOne(query);

    if (!course && ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
      course = await coursesCollection.findOne(query);
    }

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found.",
      });
    }

    let newStatus = "";
    if (action === "approve" || action === "publish") {
      newStatus = "published";
    } else if (action === "reject") {
      newStatus = "rejected";
    } else if (action === "unpublish") {
      newStatus = "unpublished";
    }

    // Guard: 'publish' can only be applied to unpublished/rejected courses
    if (
      action === "publish" &&
      !["unpublished", "rejected"].includes(course.status)
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot publish a course with status '${course.status}'.`,
      });
    }

    await coursesCollection.updateOne(query, {
      $set: {
        status: newStatus,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: `Course successfully ${action}d.`,
      status: newStatus,
    });
  } catch (error) {
    console.error(`Error processing course approval/rejection:`, error);
    res.status(500).json({
      success: false,
      message: "An error occurred while updating course status.",
      error: error.message,
    });
  }
};

module.exports = {
  getPendingCourses,
  getAllCoursesForAdmin,
  approveOrRejectCourse,
};
