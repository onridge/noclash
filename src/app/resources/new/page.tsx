import { ResourceForm } from "@/components/resources-form";

export default function ResourcePage() {
  return (
    <main className="px-4 sm:px-6 py-6 max-w-md">
      <h1 className="font-display text-2xl sm:text-3xl text-ink">
        List a resource
      </h1>
      <div className="mt-5">
        <ResourceForm />
      </div>
    </main>
  );
}
