import { useState, useEffect, useCallback, useRef } from "react";
import { getCldImageUrl, getCldVideoUrl } from "next-cloudinary"; // we need the CldImageUrl for the thumbnail of video -> also these things are hooks, get data from cloudinary then comes back.
import { Download, Clock, FileDown, FileUp } from "lucide-react";
import dayjs from "dayjs"; // to display things like "6 days ago etc."
import relativeTime from "dayjs/plugin/relativeTime"; // this is to support any timezone.
import { filesize } from "filesize";
import { Video } from "@/app/generated/prisma/client";

dayjs.extend(relativeTime);

type PreviewStatus = "idle" | "loading" | "retrying" | "playing" | "deferred";

const PREVIEW_RETRY_DELAYS_MS = [1000, 2000, 4000];
const MAX_PREVIEW_ATTEMPTS = PREVIEW_RETRY_DELAYS_MS.length + 1;

// This is a dumb component - just takes data and display it

// Step 1: Define an interface
interface VideoCardProps {
  video: Video;
}

const onDownload = (videoUrl: string) => {
  window.open(videoUrl, "_blank"); // "_blank" opens it in a fresh page. we are already passing the cloudinary url so we can download it from there.
};

// FC stands for functional component?
const VideoCard: React.FC<VideoCardProps> = ({ video }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [previewToken, setPreviewToken] = useState(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveredRef = useRef(false);

  // useCallback caches a function when passing to the children component, good to have in case we are reusing in the future?
  // dependency array is empty because it ONLY FIRES ONCE
  const getThumbnailUrl = useCallback((publicId: string) => {
    return getCldImageUrl({
      src: publicId,
      width: 400,
      height: 225,
      crop: "fill",
      gravity: "auto",
      format: "jpg",
      quality: "auto",
      assetType: "video",
    });
  }, []);

  const getFullVideoUrl = useCallback((publicId: string) => {
    return getCldVideoUrl({
      src: publicId,
      width: 1920,
      height: 1080,
    });
  }, []);

  const getPreviewVideoUrl = useCallback((publicId: string, token: number) => {
    const previewUrl = getCldVideoUrl({
      src: publicId,
      width: 400,
      height: 225,
      rawTransformations: ["e_preview:duration_15:max_seg_9:min_seg_dur_1"], // this is from the docs: https://cloudinary.com/documentation/transformation_reference
    });

    return `${previewUrl}?previewAttempt=${token}`;
  }, []);

  const formatSize = useCallback((size: number) => {
    return filesize(size);
  }, []);

  const formatDuration = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }, []);

  const clearPreviewRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const resetPreviewState = useCallback(() => {
    clearPreviewRetryTimer();
    setPreviewStatus("idle");
    setPreviewAttempt(0);
    setPreviewToken(0);
  }, [clearPreviewRetryTimer]);

  const startPreviewLoad = useCallback(() => {
    clearPreviewRetryTimer();
    setPreviewStatus("loading");
    setPreviewAttempt(1);
    setPreviewToken(0);
  }, [clearPreviewRetryTimer]);

  const handlePreviewLoaded = useCallback(() => {
    clearPreviewRetryTimer();
    setPreviewStatus("playing");
  }, [clearPreviewRetryTimer]);

  const handlePreviewError = useCallback(() => {
    clearPreviewRetryTimer();

    if (!isHoveredRef.current) {
      return;
    }

    if (previewAttempt >= MAX_PREVIEW_ATTEMPTS) {
      setPreviewStatus("deferred");
      return;
    }

    const retryDelay = PREVIEW_RETRY_DELAYS_MS[previewAttempt - 1];

    if (retryDelay === undefined) {
      setPreviewStatus("deferred");
      return;
    }

    const nextAttempt = previewAttempt + 1;
    setPreviewStatus("retrying");

    retryTimerRef.current = setTimeout(() => {
      if (!isHoveredRef.current) {
        return;
      }

      setPreviewAttempt(nextAttempt);
      setPreviewToken((currentToken) => currentToken + 1);
      setPreviewStatus("loading");
      retryTimerRef.current = null;
    }, retryDelay);
  }, [clearPreviewRetryTimer, previewAttempt]);

  useEffect(() => {
    return () => {
      clearPreviewRetryTimer();
    };
  }, [clearPreviewRetryTimer]);

  const compressionPercentage = Math.round(
    (1 - Number(video.compressedSize) / Number(video.originalSize)) * 100,
  );

  const shouldRenderPreviewVideo =
    isHovered && (previewStatus === "loading" || previewStatus === "playing");

  const previewOverlayMessage =
    previewStatus === "deferred"
      ? "Preview still generating. Hover again shortly."
      : isHovered && previewStatus !== "playing"
        ? "Generating preview..."
        : null;

  const previewOverlayTone =
    previewStatus === "deferred"
      ? "bg-black/65 text-amber-100"
      : "bg-black/45 text-white";

  const previewVideoClassName =
    previewStatus === "playing" ? "opacity-100" : "opacity-0";

  const thumbnailUrl = getThumbnailUrl(video.publicId);
  const previewUrl = getPreviewVideoUrl(video.publicId, previewToken);

  const handleMouseEnter = useCallback(() => {
    isHoveredRef.current = true;
    setIsHovered(true);
    startPreviewLoad();
  }, [startPreviewLoad]);

  const handleMouseLeave = useCallback(() => {
    isHoveredRef.current = false;
    setIsHovered(false);
    resetPreviewState();
  }, [resetPreviewState]);

  return (
    <div
      className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300"
      onMouseEnter={handleMouseEnter} // this is how we detect when mouse hovered over something.
      onMouseLeave={handleMouseLeave}
    >
      <figure className="aspect-video relative">
        <img
          src={thumbnailUrl} // url of the thumbnail
          alt={video.title}
          className="w-full h-full object-cover"
        />
        {shouldRenderPreviewVideo ? (
          <video
            key={previewToken}
            src={previewUrl}
            autoPlay // this is 'autoPlay = true'
            muted
            loop
            playsInline
            preload="metadata"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${previewVideoClassName}`}
            onLoadedData={handlePreviewLoaded}
            onError={handlePreviewError}
          />
        ) : null}
        {previewOverlayMessage ? (
          <div
            className={`absolute inset-0 flex items-center justify-center px-4 text-center text-sm font-medium ${previewOverlayTone}`}
          >
            <p>{previewOverlayMessage}</p>
          </div>
        ) : null}
        <div className="absolute bottom-2 right-2 bg-base-100 bg-opacity-70 px-2 py-1 rounded-lg text-sm flex items-center">
          <Clock size={16} className="mr-1" />
          {formatDuration(video.duration)}
        </div>
      </figure>
      <div className="card-body p-4">
        <h2 className="card-title text-lg font-bold">{video.title}</h2>
        <p className="text-sm text-base-content opacity-70 mb-4">
          {video.description}
        </p>
        <p className="text-sm text-base-content opacity-70 mb-4">
          Uploaded {dayjs(video.createdAt).fromNow()}
        </p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center">
            <FileUp size={18} className="mr-2 text-primary" />
            <div>
              <div className="font-semibold">Original</div>
              <div>{formatSize(Number(video.originalSize))}</div>
            </div>
          </div>
          <div className="flex items-center">
            <FileDown size={18} className="mr-2 text-secondary" />
            <div>
              <div className="font-semibold">Compressed</div>
              <div>{formatSize(Number(video.compressedSize))}</div>
            </div>
          </div>
        </div>
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm font-semibold">
            Compression:{" "}
            <span className="text-accent">{compressionPercentage}%</span>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onDownload(getFullVideoUrl(video.publicId))}
          >
            <Download size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCard;
// note: <Download /> is the react icon.
