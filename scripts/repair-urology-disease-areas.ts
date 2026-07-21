import { Specialty } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { UROLOGY_SPECIALTY } from "../src/lib/constants";

function inferDiseaseArea(title: string, abstract?: string | null) {
  const text = `${title} ${abstract ?? ""}`.toLowerCase();
  if (/urinary tract infection|cystitis|pyelonephritis|\buti\b/.test(text)) return "尿路感染";
  if (/pediatric|paediatric|children|child|adolescent/.test(text)) return "儿童泌尿";
  if (/urolithiasis|urinary stone|kidney stone|ureteral stone|nephrolithiasis/.test(text)) return "泌尿系结石";
  if (/incontinence|female urology|overactive bladder|pelvic floor/.test(text)) return "尿失禁与女性泌尿";
  if (/neuro-urology|neurogenic/.test(text)) return "神经泌尿";
  if (/infertility|erectile|andrology|sexual dysfunction/.test(text)) return "男科、男性不育与性功能障碍";
  if (/trauma|reconstruction|urethral stricture|urethroplasty/.test(text)) return "泌尿系统创伤与重建";
  if (/benign prostatic hyperplasia|lower urinary tract symptoms|\bluts\b/.test(text)) {
    return "良性前列腺增生与男性下尿路症状";
  }
  if (/upper tract urothelial/.test(text)) return "上尿路尿路上皮癌";
  if (/testicular|penile/.test(text)) return "睾丸癌及阴茎癌";
  if (/prostate cancer|psma|castration-resistant/.test(text)) return "前列腺癌";
  if (/bladder cancer|urothelial carcinoma/.test(text)) return "膀胱癌";
  if (/renal cell|kidney cancer|renal cancer/.test(text)) return "肾癌";
  if (/transplant/.test(text)) return "肾移植及其他泌尿外科相关疾病";
  return "肾移植及其他泌尿外科相关疾病";
}

async function main() {
  const articles = await prisma.article.findMany({
    where: { specialty: UROLOGY_SPECIALTY as Specialty },
    select: {
      id: true,
      titleEn: true,
      abstract: true,
      diseaseArea: true,
    },
  });

  let updated = 0;
  for (const article of articles) {
    const diseaseArea = inferDiseaseArea(article.titleEn, article.abstract);
    if (article.diseaseArea === diseaseArea) continue;
    await prisma.article.update({
      where: { id: article.id },
      data: { diseaseArea },
    });
    updated++;
  }

  console.log(`[repair-urology-disease-areas] scanned=${articles.length}, updated=${updated}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
