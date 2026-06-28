const getPlatformWideAnalytics =
  (usersCollection, coursesCollection, transactionsCollection) =>
  async (req, res) => {
    try {
      // 1. Platform Overview Counters
      const totalStudents = await usersCollection.countDocuments({
        role: "student",
      });
      const totalInstructors = await usersCollection.countDocuments({
        role: "instructor",
      });
      const totalCourses = await coursesCollection.countDocuments();

      // Total Revenue
      const revenueAggregation = await transactionsCollection
        .aggregate([
          { $match: { paymentStatus: "paid" } },
          { $group: { _id: null, totalPlatformRevenue: { $sum: "$amount" } } },
        ])
        .toArray();

      const totalPlatformRevenue =
        revenueAggregation.length > 0
          ? revenueAggregation[0].totalPlatformRevenue
          : 0;

      // 2. Comprehensive Growth Graph Data (Group by year/month)
      const chartAggregation = await transactionsCollection
        .aggregate([
          { $match: { paymentStatus: "paid" } },
          {
            $group: {
              _id: {
                year: {
                  $year: { $dateFromString: { dateString: "$createdAt" } },
                },
                month: {
                  $month: { $dateFromString: { dateString: "$createdAt" } },
                },
              },
              revenue: { $sum: "$amount" },
              signups: { $sum: 1 }, // Assuming course purchases map to user enrollments/signups
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ])
        .toArray();

      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      
      const globalChartData = chartAggregation.map((item) => ({
        month: `${monthNames[item._id.month - 1]}`,
        revenue: item.revenue,
        signups: item.signups,
        year: item._id.year,
      }));

      return res.json({
        success: true,
        globalOverview: {
          totalStudents,
          totalInstructors,
          totalCourses,
          totalPlatformRevenue,
        },
        globalChartData,
      });
    } catch (error) {
      console.error("Platform Analytics Error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  };

module.exports = {
  getPlatformWideAnalytics,
};
