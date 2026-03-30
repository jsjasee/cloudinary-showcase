"use client";
import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import VideoCard from "@/components/VideoCard";
// import { Video } from "@/types";
import { Video } from "@/app/generated/prisma/client";
import toast from "react-hot-toast";

function Home() {
  const [videos, setVideos] = useState<Array<Video>>([]); // you can either write Array<Video> or Video[]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    try {
      const response = await axios.get("/api/videos");
      if (Array.isArray(response.data)) {
        setVideos(response.data);
      } else {
        throw new Error("Unexpected response format.");
      }
    } catch (error) {
      console.log(error);
      toast.error("Failed to fetch videos");
      setError("Failed to fetch videos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]); // what is this doing here??

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Videos</h1>
      {videos.length === 0 ? (
        <div className="text-center text-lg text-gray-500">
          No videos available
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}

export default Home;
