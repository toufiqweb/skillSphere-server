const { ObjectId } = require("mongodb");

const deleteInappropriateReview = (reviewsCollection, coursesCollection) => async (req, res) => {
  try {
    const { id: reviewId } = req.params;

    if (!ObjectId.isValid(reviewId)) {
      return res.status(400).json({ success: false, message: "Invalid review ID." });
    }

    // Step 1: Fetch the Target Review
    const review = await reviewsCollection.findOne({ _id: new ObjectId(reviewId) });
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found." });
    }

    const { courseId, rating: deletedRatingValue } = review;

    // Step 2: Remove Document
    await reviewsCollection.deleteOne({ _id: new ObjectId(reviewId) });

    // Step 3: Atomic Course Math Recalculation
    let query;
    if (ObjectId.isValid(courseId)) {
      query = { _id: new ObjectId(courseId) };
    } else {
      query = { id: courseId };
    }

    const course = await coursesCollection.findOne(query);
    
    if (course) {
      const oldCount = course.totalRatingsCount || course.ratingCount || 0;
      const oldAvg = course.rating || course.averageRating || 0;

      const newCount = oldCount > 0 ? oldCount - 1 : 0;
      let newAvg = 0;
      
      if (newCount > 0) {
        newAvg = ((oldAvg * oldCount) - deletedRatingValue) / newCount;
        newAvg = Math.round(newAvg * 10) / 10;
      }

      await coursesCollection.updateOne(query, {
        $set: {
          rating: newAvg,
          averageRating: newAvg,
          totalRatingsCount: newCount,
          ratingCount: newCount,
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: "Inappropriate review scrubbed and course aggregation successfully synchronized.",
    });
  } catch (error) {
    console.error("Error deleting review:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete review.",
      error: error.message,
    });
  }
};

module.exports = {
  deleteInappropriateReview,
};
