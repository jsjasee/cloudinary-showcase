import { v2 as cloudinary } from "cloudinary";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server"; // just have an additional check
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface CloudinaryUploadResult {
  public_id: string;
  bytes: number;
  duration?: number;
  [key: string]: any;
}

export async function POST(request: NextRequest) {
  try {
    // checks for the user
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return NextResponse.json(
        { error: "Cloudinary credentials not found" },
        { status: 500 },
      );
    }

    // full proof way to upload image
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const originalSize = formData.get("originalSize") as string;

    // this 'file' name in .get("file") is based on frontend

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 400 });
    }

    // this code is copy-pastable
    // step 1. - this is an arrayBuffer
    const bytes = await file.arrayBuffer();
    // step 2. - change it to a buffer
    const buffer = Buffer.from(bytes);
    // step 3. - throw it in cloudinary and END the uploadStream.
    const uploadResult = await new Promise<CloudinaryUploadResult>(
      (resolve, reject) => {
        // this is used to upload anything to cloudinary
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            // specify where to store the things, optional
            folder: "next-cloudinary-video-uploads",
            resource_type: "video",
            transformation: [
              {
                quality: "auto",
                fetch_format: "mp4", // only allowed to upload mp4?
              },
            ],
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else if (result) {
              resolve(result);
            }
          },
        );

        uploadStream.end(buffer);
      },
    );

    const video = await prisma.video.create({
      data: {
        title,
        description,
        publicId: uploadResult.public_id,
        originalSize: originalSize,
        compressedSize: String(uploadResult.bytes),
        duration: uploadResult.duration || 0, // if we get the duration, great otherwise it is 0
      },
    });

    return NextResponse.json(video);
  } catch (error) {
    console.log("Upload video failed: ", error);
    return NextResponse.json({ error: "Upload video failed" }, { status: 500 });
  } finally {
    await prisma.$disconnect(); // disconnect everytime when you are done with prisma!
  }
}

// after we upload the email to cloudinary, we need to extract public_id from the result in order to show the videos to the users.
