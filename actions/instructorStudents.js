const getInstructorEnrolledStudents = (transactionsCollection) => async (req, res) => {
  try {
    const rawUserId = req.headers["x-user-id"] || req.headers["userid"] || req.headers["instructorid"];
    if (!rawUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Missing instructor ID.",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const matchQuery = {
      instructorId: rawUserId,
      paymentStatus: "paid",
    };

    const totalItems = await transactionsCollection.countDocuments(matchQuery);
    const totalPages = Math.ceil(totalItems / limit);

    // Pipeline to fetch transactions and lookup user and course details
    const pipeline = [
      { $match: matchQuery },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $addFields: {
          userObjectId: { $toObjectId: "$userId" },
          courseObjectId: { $toObjectId: "$courseId" }
        }
      },
      {
        $lookup: {
          from: "user",
          localField: "userObjectId",
          foreignField: "_id",
          as: "studentDetails"
        }
      },
      {
        $lookup: {
          from: "courses",
          localField: "courseObjectId",
          foreignField: "_id",
          as: "courseDetails"
        }
      },
      {
        $unwind: {
          path: "$studentDetails",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $unwind: {
          path: "$courseDetails",
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          amount: 1,
          createdAt: 1,
          studentName: "$studentDetails.name",
          studentEmail: { $ifNull: ["$studentDetails.email", "$userEmail"] },
          studentImage: { $ifNull: ["$studentDetails.image", "$studentDetails.profileImage"] },
          courseTitle: { $ifNull: ["$courseDetails.title", "Unknown Course"] }
        }
      }
    ];

    const enrolledStudentsList = await transactionsCollection.aggregate(pipeline).toArray();

    return res.status(200).json({
      success: true,
      totalItems,
      totalPages: totalPages === 0 ? 1 : totalPages,
      currentPage: page,
      data: enrolledStudentsList,
    });
  } catch (error) {
    console.error("Error fetching instructor students:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch enrolled students",
      error: error.message,
    });
  }
};

module.exports = {
  getInstructorEnrolledStudents,
};
