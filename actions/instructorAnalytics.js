const getInstructorAnalytics = (transactionsCollection, coursesCollection) => async (req, res) => {
  try {
    const rawUserId = req.headers["x-user-id"] || req.headers["userid"] || req.headers["instructorid"];
    if (!rawUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Missing instructor ID.",
      });
    }

    const matchQuery = {
      instructorId: rawUserId,
      paymentStatus: "paid",
    };

    // 1. Overview Counters (Earnings & Enrollments)
    const overviewPipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$amount" },
          totalEnrollments: { $sum: 1 },
        }
      }
    ];

    const overviewResult = await transactionsCollection.aggregate(overviewPipeline).toArray();
    const totalEarnings = overviewResult.length > 0 ? overviewResult[0].totalEarnings : 0;
    const totalEnrollments = overviewResult.length > 0 ? overviewResult[0].totalEnrollments : 0;

    // 2. Average Course Rating
    const coursePipeline = [
      { $match: { "instructor.instructorId": rawUserId } },
      {
        $project: {
          computedRating: {
            $ifNull: ["$averageRating", { $ifNull: ["$rating", 0] }]
          }
        }
      },
      {
        $match: { computedRating: { $gt: 0 } }
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$computedRating" },
        }
      }
    ];
    
    const courseResult = await coursesCollection.aggregate(coursePipeline).toArray();
    const avgRating = courseResult.length > 0 ? Number(courseResult[0].avgRating?.toFixed(1) || 0) : 0;

    // 3. Monthly Graph Analytics
    const monthlyPipeline = [
      { $match: matchQuery },
      {
        $group: {
          _id: {
            year: { $year: { $dateFromString: { dateString: "$createdAt" } } },
            month: { $month: { $dateFromString: { dateString: "$createdAt" } } },
          },
          earnings: { $sum: "$amount" },
          enrollments: { $sum: 1 },
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ];

    const monthlyResult = await transactionsCollection.aggregate(monthlyPipeline).toArray();
    
    // Map to month string format (e.g. "Jan", "Feb")
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const chartData = monthlyResult.map(item => ({
      month: monthNames[item._id.month - 1],
      earnings: item.earnings,
      enrollments: item.enrollments
    }));

    // Fill in missing months to provide a better visual if few records exist
    const currentMonth = new Date().getMonth();
    const finalChartData = [];
    for (let i = 5; i >= 0; i--) {
      let m = currentMonth - i;
      if (m < 0) m += 12;
      const monthStr = monthNames[m];
      
      const found = chartData.find(d => d.month === monthStr);
      if (found) {
        finalChartData.push(found);
      } else {
        // Only push empty if we want continuous, but let's just stick to the requested structure or a 6-month trailing
        finalChartData.push({ month: monthStr, earnings: 0, enrollments: 0 });
      }
    }

    // Merge the sparse chartData with the trailing 6 months (or just return the chartData directly if they prefer)
    // To be perfectly accurate to what they asked and not assume 6 months, we will just return chartData if it has items, 
    // but if it's empty, we'll return a basic structure to make the chart look nice.
    const outputChartData = chartData.length > 0 ? chartData : finalChartData;

    return res.status(200).json({
      success: true,
      overview: {
        totalEarnings,
        totalEnrollments,
        avgRating,
      },
      chartData: outputChartData
    });

  } catch (error) {
    console.error("Error fetching instructor analytics:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch analytics",
      error: error.message,
    });
  }
};

module.exports = {
  getInstructorAnalytics,
};
