const { ObjectId } = require("mongodb");

// 1. POST - Create Course (/api/courses)
const createCourse = (coursesCollection) => async (req, res) => {
  try {
    const courseData = req.body;

    // Safe validation
    if (
      !courseData.title ||
      !courseData.category ||
      !courseData.price ||
      !courseData.image ||
      !courseData.description
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: title, category, price, image, and description are required.",
      });
    }

    // Force inject default values on the server side
    const courseToSave = {
      ...courseData,
      lessons: Number(courseData.lessons) || 0,
      price: Number(courseData.price),
      originalPrice: courseData.originalPrice
        ? Number(courseData.originalPrice)
        : Number(courseData.price),
      students: 0,
      rating: 0,
      reviewCount: 0,
      status: "pending", // ALWAYS "pending" on creation
      createdAt: new Date(),
    };

    // Safely format curriculum
    if (Array.isArray(courseToSave.curriculum)) {
      courseToSave.curriculum = courseToSave.curriculum.map((chap, idx) => ({
        id: chap.id || String(idx + 1).padStart(2, "0"),
        title: String(chap.title || ""),
        lectures: Number(chap.lectures || 0),
      }));
    }

    const result = await coursesCollection.insertOne(courseToSave);

    if (result.insertedId) {
      res.status(201).json({
        success: true,
        message: "Course created successfully and is pending approval.",
        data: { _id: result.insertedId, ...courseToSave },
      });
    } else {
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to insert course into database.",
        });
    }
  } catch (error) {
    console.error("POST Course Error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while creating the course.",
      error: error.message,
    });
  }
};

// 2. GET - Get all courses with query parameters (/api/courses)
const getCourses = (coursesCollection) => async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 12;
    const search = req.query.search || "";
    const category = req.query.category || "";
    const level = req.query.level || "";
    const sort = req.query.sort || "";
    const instructorId = req.query.instructorId || "";

    const query = {};

    // Search logic for title and description
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    // Category filtering
    if (category && category.toLowerCase() !== "all") {
      query.category = category;
    }

    // Level filtering
    if (level && level.toLowerCase() !== "all") {
      query.level = level;
    }

    // Instructor filtering
    if (instructorId) {
      query["instructor.instructorId"] = instructorId;
    }

    // Sorting logic
    let sortOption = {};
    if (sort === "rating") sortOption = { rating: -1 };
    else if (sort === "students") sortOption = { students: -1 };
    else if (sort === "price-low") sortOption = { price: 1 };
    else if (sort === "price-high") sortOption = { price: -1 };

    // Pagination logic
    const skip = (page - 1) * limit;

    // Fetch total count and paginated data
    const totalCourses = await coursesCollection.countDocuments(query);
    const result = await coursesCollection
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .toArray();

    res.status(200).json({
      success: true,
      message: "Courses fetched successfully",
      data: result,
      meta: {
        totalCourses,
        totalPages: Math.ceil(totalCourses / limit) || 1,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching courses",
      error: error.message,
    });
  }
};

// 3. GET - Get single course details (/api/courses/:id)
const getCourseById = (coursesCollection) => async (req, res) => {
  try {
    const id = req.params.id;

    // Try searching by numeric id first
    let query = { id: parseInt(id, 10) };
    let course = await coursesCollection.findOne(query);

    // Fallback to ObjectId if it's a valid MongoDB ID
    if (!course && ObjectId.isValid(id)) {
      course = await coursesCollection.findOne({ _id: new ObjectId(id) });
    }

    if (course) {
      res.status(200).json({ success: true, data: course });
    } else {
      res.status(404).json({ success: false, message: "Course not found" });
    }
  } catch (error) {
    console.error("Error fetching course details:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching course details",
      error: error.message,
    });
  }
};

// 4. DELETE - Delete course details (/api/courses/:id)
const deleteCourse = (coursesCollection) => async (req, res) => {
  try {
    const id = req.params.id;

    // Try searching by numeric id first
    let query = { id: parseInt(id, 10) };
    let result = await coursesCollection.deleteOne(query);

    // Fallback to ObjectId if it's a valid MongoDB ID
    if (result.deletedCount === 0 && ObjectId.isValid(id)) {
      result = await coursesCollection.deleteOne({ _id: new ObjectId(id) });
    }

    if (result.deletedCount > 0) {
      res.status(200).json({ success: true, message: "Course deleted successfully" });
    } else {
      res.status(404).json({ success: false, message: "Course not found" });
    }
  } catch (error) {
    console.error("Error deleting course:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while deleting the course",
      error: error.message,
    });
  }
};

// 5. GET - Get courses by instructor with pagination (/api/courses/instructor/:instructorId)
const getCoursesByInstructor = (coursesCollection) => async (req, res) => {
  try {
    const instructorId = req.params.instructorId;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const search = req.query.search || "";
    const category = req.query.category || "";
    const status = req.query.status || "";
    const sort = req.query.sort || "";
    const skip = (page - 1) * limit;

    const query = { "instructor.instructorId": instructorId };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (category && category.toLowerCase() !== "all" && category.trim() !== "") {
      query.category = category;
    }

    if (status && status.toLowerCase() !== "all" && status.trim() !== "") {
      query.status = status.toLowerCase();
    }

    let sortOption = {};
    if (sort === "price-low") sortOption = { price: 1 };
    else if (sort === "price-high") sortOption = { price: -1 };
    else if (sort === "title-asc") sortOption = { title: 1 };
    else if (sort === "title-desc") sortOption = { title: -1 };
    else sortOption = { createdAt: -1 };

    const totalCourses = await coursesCollection.countDocuments(query);
    const result = await coursesCollection
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .toArray();

    res.status(200).json({
      success: true,
      message: "Instructor courses fetched successfully",
      data: result,
      meta: {
        totalCourses,
        totalPages: Math.ceil(totalCourses / limit) || 1,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    console.error("Error fetching instructor courses:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while fetching instructor courses",
      error: error.message,
    });
  }
};

module.exports = {
  createCourse,
  getCourses,
  getCourseById,
  deleteCourse,
  getCoursesByInstructor,
};
