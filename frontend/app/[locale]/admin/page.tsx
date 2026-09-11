import { redirect } from "next/navigation";
export default function AdminIndex({ params }: { params:{locale:string}}){
  redirect(`/${params.locale}/admin/dashboard`);
}
