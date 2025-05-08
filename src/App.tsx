import { Authenticated, Unauthenticated, useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster, toast } from "sonner";
import { useState, useRef } from "react";
import { Id } from "../convex/_generated/dataModel";

export default function App() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-white/80 backdrop-blur-sm">
        <h2 className="text-xl font-semibold accent-text">Cloudlet</h2>
        <SignOutButton />
      </header>
      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <Content />
        </div>
      </main>
      <Toaster />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const [currentFolder, setCurrentFolder] = useState<Id<"folders"> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const items = useQuery(api.files.listItems, { parentId: currentFolder });
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createFile = useMutation(api.files.createFile);
  const createFolder = useMutation(api.files.createFolder);
  const deleteFile = useMutation(api.files.deleteFile);
  const deleteFolder = useMutation(api.files.deleteFolder);
  const deleteFileFromS3 = useAction(api.files.deleteFileFromS3);

  if (loggedInUser === undefined) {
    return (
      <div className="flex items-center justify-center">
        <div className="w-8 h-8 border-b-2 border-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
  
    try {
      // Generate the upload URL and get the unique file name
      const { uploadUrl, uniqueFileName } = await generateUploadUrl({
        fileName: file.name,
        fileType: file.type,
      });
  
      const result = await fetch(uploadUrl, {
        method: "PUT", // Use PUT for S3 pre-signed URLs
        headers: { "Content-Type": file.type },
        body: file,
      });
  
      if (!result.ok) {
        throw new Error("Failed to upload file to S3");
      }
  
      // Create the file record in the database with the unique file name as storageId
      await createFile({
        name: file.name,
        size: file.size,
        storageId: uniqueFileName, // Use the unique file name as the storage ID
        parentId: currentFolder,
      });
  
      toast.success("File uploaded successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload file");
    }
  };

  const handleCreateFolder = async () => {
    const name = prompt("Enter folder name:");
    if (!name) return;

    try {
      await createFolder({ name, parentId: currentFolder });
      toast.success("Folder created successfully");
    } catch (error) {
      toast.error("Failed to create folder");
    }
  };
  
  const handleDeleteFile = async (file: { _id: string; storageId: string }) => {
    try {
      await deleteFile({ storageId: file.storageId });
      await deleteFileFromS3({ storageId: file.storageId }); // 👈 S3 deletion after DB mutation
      toast.success("File deleted successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete file");
    }
  };
  
  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <h1 className="mb-4 text-5xl font-bold accent-text">CloudLet</h1>
        <Authenticated>
          <p className="text-xl text-slate-600">
            Welcome back, {loggedInUser?.email ?? "friend"}!
          </p>
        </Authenticated>
        <Unauthenticated>
          <p className="text-xl text-slate-600">Sign in to get started</p>
        </Unauthenticated>
      </div>

      <Unauthenticated>
        <SignInForm />
      </Unauthenticated>

      <Authenticated>
        <div className="flex gap-4 mb-4">
          <input
            type="file"
            ref={fileInput}
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInput.current?.click()}
            className="px-4 py-2 text-white bg-indigo-500 rounded hover:bg-indigo-600"
          >
            Upload File
          </button>
          <button
            onClick={handleCreateFolder}
            className="px-4 py-2 text-white bg-gray-500 rounded hover:bg-gray-600"
          >
            New Folder
          </button>
          {currentFolder && (
            <button
              onClick={() => setCurrentFolder(null)}
              className="px-4 py-2 text-white bg-gray-500 rounded hover:bg-gray-600"
            >
              Back to Root
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items?.folders.map((folder) => (
            <div
              key={folder._id}
              className="flex items-center justify-between p-4 border rounded"
            >
              <button
                onClick={() => setCurrentFolder(folder._id)}
                className="flex items-center gap-2"
              >
                📁 {folder.name}
              </button>
              <button
                onClick={() => deleteFolder({ folderId: folder._id })}
                className="text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          ))}

          {items?.files.map((file) => (
            <div
              key={file._id}
              className="flex items-center justify-between p-4 border rounded"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  📄 {file.name}
                </div>
                <div className="text-sm text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB •{" "}
                  {new Date(file._creationTime).toLocaleDateString()}
                </div>
              </div>
              <div className="flex gap-2">
                {file.url && (
                  <a
                    href={file.url}
                    download={file.name}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    Download
                  </a>
                )}
                <button
                  onClick={() => handleDeleteFile(file)}
                  className="text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </Authenticated>
    </div>
  );
}
