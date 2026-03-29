import { v2 as cloudinary } from "cloudinary";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server"; // just have an additional check

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

interface CloudinaryUploadResult {
  public_id: string;
  [key: string]: any;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // full proof way to upload image
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
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
            folder: "next-cloudinary-uploads",
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

    return NextResponse.json(
      { publicId: uploadResult.public_id },
      { status: 200 },
    );
  } catch (error) {
    console.log("Upload image failed: ", error);
    return NextResponse.json({ error: "Upload image failed" }, { status: 500 });
  }
}
