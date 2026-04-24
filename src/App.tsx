/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  ShieldCheck, 
  Trash2, 
  User, 
  Camera, 
  Upload, 
  Image as ImageIcon, 
  Layers, 
  Sparkles, 
  Download, 
  FileCheck, 
  Loader2, 
  AlertCircle, 
  X,
  Plus,
  Info
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/src/lib/utils";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const OPTIONS = {
  kegiatan: ["Pendampingan Perencanaan Berbasis Data", "Supervisi Akademik Berkelanjutan", "Pendampingan Implementasi Kurikulum Merdeka", "Pembinaan Tata Kelola Satuan Pendidikan", "Evaluasi Kinerja Kepala Sekolah", "Fasilitasi Komunitas Belajar", "Lainnya"],
  pilar: [
    { title: "Pilar 1: Kepemimpinan Pembelajaran", items: ["Kepemimpinan Instruksional", "Pengembangan Budaya Refleksi", "Pengelolaan Data Capaian Belajar"] },
    { title: "Pilar 2: Ekosistem Belajar", items: ["Kurikulum Satuan Pendidikan", "Perencanaan Pembelajaran", "Asesmen dan Umpan Balik", "Lingkungan Belajar Inklusif"] },
    { title: "Pilar 3: Kapasitas Organisasi", items: ["Pengembangan SDM", "Transformasi Digital Sekolah", "Kemitraan dan Peran Serta Masyarakat"] },
    { title: "Pilar 4: Implementasi Kebijakan", items: ["Pencegahan Kekerasan (PPKSP)", "Isu Strategis Pendidikan", "Implementasi Budaya Kerja"] }
  ],
  model: ["Model Siklus Pendampingan", "Model individual", "Model kelompok", "Model kolaboratif", "Model Supervisi klinis"],
  pendekatan: ["Pendekatan Coaching", "Pendekatan Kolaboratif", "Pendekatan Reflektif"],
  metode: ["Observasi Kelas", "Wawancara", "Diskusi Terfokus (FGD)", "Refleksi Terbimbing", "Studi Dokumen"],
  strategi: ["Pemetaan Kebutuhan Sekolah", "Pendampingan Intensif", "Umpan Balik Konstruktif", "Mentoring"]
};

interface FormState {
  namaPengawas: string;
  nipPengawas: string;
  namaSekolah: string;
  tanggal: string;
  jenisKegiatan: string;
  temaSpesifik: string;
  model: string;
  pendekatan: string;
  metode: string;
  strategi: string;
  catatan: string;
  namaKepsek: string;
  nipKepsek: string;
  pilar: string[];
}

export default function App() {
  const [form, setForm] = useState<FormState>({
    namaPengawas: "Sasno, S.Pd., M.Pd.",
    nipPengawas: "196811201992031004",
    namaSekolah: "",
    tanggal: "",
    jenisKegiatan: "",
    temaSpesifik: "",
    model: "",
    pendekatan: "",
    metode: "",
    strategi: "",
    catatan: "",
    namaKepsek: "",
    nipKepsek: "",
    pilar: []
  });

  const [images, setImages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("pengawas_pro_draft_v3");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge saved data into current state, but prioritize defaults if missing
      setForm(prev => ({
        ...prev,
        ...parsed.form,
        namaPengawas: parsed.form?.namaPengawas || prev.namaPengawas,
        nipPengawas: parsed.form?.nipPengawas || prev.nipPengawas
      }));
      setImages(parsed.images || {});
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("pengawas_pro_draft_v3", JSON.stringify({ form, images }));
  }, [form, images]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setForm(prev => ({ ...prev, [id]: value }));
  };

  const handleCheckboxChange = (item: string) => {
    setForm(prev => {
      const pilar = prev.pilar.includes(item) 
        ? prev.pilar.filter(i => i !== item)
        : [...prev.pilar, item];
      return { ...prev, pilar };
    });
  };

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      const compressed = await compressImage(base64);
      setImages(prev => ({ ...prev, [key]: compressed }));
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    if (confirm("Mulai dari awal? Semua data akan dihapus.")) {
      localStorage.removeItem("pengawas_pro_draft_v3");
      window.location.reload();
    }
  };

  const generateReport = async () => {
    if (!form.namaSekolah) {
      setError("Harap masukkan Nama Sekolah.");
      return;
    }

    setLoading(true);
    setError(null);

    const promptContent = `Buatkan Laporan Pendampingan Pengawas Sekolah profesional untuk sekolah ${form.namaSekolah}. 
    Tema Spesifik: ${form.temaSpesifik || "Sesuai tugas pokok pengawasan"}.
    Fokus pilar: ${form.pilar.join(', ')}. 
    Model: ${form.model}, Pendekatan: ${form.pendekatan}, Metode: ${form.metode}, Strategi: ${form.strategi}.
    Temuan: ${form.catatan}. 
    Sesuai standar operasional pengawasan berdasarkan PERMENDIKDASMEN NO 21 & 11/ 2025.
    Gunakan Bahasa Indonesia formal, buat dalam 4 Bab: I. Pendahuluan, II. Deskripsi Kegiatan (Sajikan dalam tabel), III. Hasil Pendampingan, IV. Rekomendasi (Sajikan tabel RTL). Akhiri di bab IV.`;
    
    const systemPrompt = `Anda adalah ahli penulisan laporan pengawas sekolah senior di Indonesia yang sangat ahli dalam menyusun dokumen formal sesuai PERMENDIKDASMEN NO 21 & 11 TAHUN 2025.
    
    Tugas Anda adalah menyusun laporan dengan struktur sebagai berikut:
    
    1. PENDAHULUAN: Berikan latar belakang yang kuat mengenai pentingnya pendampingan sekolah, serta sebutkan dasar hukum yang relevan. Gunakan narasi yang mengalir dan sangat formal.
    2. DESKRIPSI KEGIATAN: Sajikan WAJIB dalam format TABEL Markdown yang sangat rapi (| No | Waktu | Deskripsi Kegiatan | Sasaran | Hasil yang Diharapkan |). 
       - Penting: Gunakan deskripsi yang padat agar tabel tidak terlalu panjang secara vertikal.
       - Kolom "No" harus ringkas.
    3. HASIL PENDAMPINGAN: Berikan analisis mendalam mengenai temuan di lapangan. Gunakan poin-poin yang jelas dan deskripsi yang profesional mengenai capaian atau tantangan.
    4. REKOMENDASI RENCANA TINDAK LANJUT (RTL): Sajikan WAJIB dalam format TABEL Markdown (| No | Program/Kegiatan | Tujuan | Sasaran | Waktu Pelaksanaan | Keterangan |).
       - Buat rekomendasi yang aplikatif dan konkret bagi sekolah.
    
    KETENTUAN PENTING:
    - Di bagian paling akhir setelah BAB IV, tambahkan kalimat: "Laporan ini disusun secara objektif untuk digunakan sebagai dasar pengambilan kebijakan peningkatan mutu di satuan pendidikan."
    - Gunakan Bahasa Indonesia formal (EYD).
    - Pastikan tabel dibuat dengan format Markdown standar yang benar-benar valid.
    - Struktur tabel harus proporsional untuk dokumen A4.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: promptContent,
        config: {
          systemInstruction: systemPrompt,
        }
      });
      
      const text = response.text;
      if (!text) throw new Error("Tidak ada respon dari AI");
      
      setReport(text);
      setTimeout(() => {
        outputRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      setError(err.message || "Gagal membuat laporan");
    } finally {
      setLoading(false);
    }
  };

  const exportWord = () => {
    const reportElem = document.getElementById('report-paper');
    if (!reportElem) return;
    
    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <style>
          @page { size: A4; margin: 2.5cm; }
          body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.5; color: black; }
          h1, h2, h3 { text-align: center; text-transform: uppercase; margin-top: 20pt; margin-bottom: 12pt; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; border: 0.5pt solid #333; margin-top: 15pt; margin-bottom: 15pt; table-layout: auto; }
          th { background-color: #f8fafc; font-weight: bold; text-align: center; border: 0.5pt solid #333; padding: 10pt 8pt; font-size: 10pt; color: #1e293b; }
          td { border: 0.5pt solid #333; padding: 10pt 8pt; vertical-align: top; font-size: 10pt; line-height: 1.4; }
          p { margin-bottom: 12pt; text-align: justify; }
          .photo-grid { display: table; width: 100%; border: none; margin-top: 20pt; }
          .photo-item { display: table-cell; padding: 10pt; border: none; width: 50%; vertical-align: top; }
          img { max-width: 100%; height: auto; display: block; margin: 0 auto; border-radius: 4pt; }
          .footer-table { width: 100%; border: none; margin-top: 40pt; }
          .footer-table td { border: none; text-align: center; width: 50%; padding: 0; }
        </style>
      </head>
      <body>
        ${reportElem.innerHTML}
      </body>
      </html>
    `;
    
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Laporan_Pendampingan_${form.namaSekolah || 'Sekolah'}_${form.tanggal || ''}.doc`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 text-white rounded-xl shadow-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-extrabold text-slate-800 tracking-tight leading-none">APLIKASI PEMBUAT LAPORAN PENGAWAS</h1>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">PERMENDIKDASMEN NO 21 & 11/ 2025</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowHelp(true)}
              className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
              title="Informasi"
            >
              <Info className="w-5 h-5" />
            </button>
            <button 
              onClick={resetForm}
              className="p-2 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
              title="Reset Data"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-8 space-y-8">
        
        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-red-50 text-red-700 p-4 rounded-2xl text-sm border border-red-100 flex items-start gap-3 shadow-sm"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <p className="font-bold">Gagal Membuat Laporan</p>
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-red-400">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Identity */}
            <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-6">
                <User className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Identitas Pengawas</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1.5 uppercase">Nama Lengkap</label>
                  <input 
                    type="text" id="namaPengawas" 
                    value={form.namaPengawas} onChange={handleInputChange}
                    placeholder="Sasno, S.Pd., M.Pd." 
                    className="w-full p-3 bg-slate-50 text-sm rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1.5 uppercase">NIP / ID</label>
                  <input 
                    type="text" id="nipPengawas" 
                    value={form.nipPengawas} onChange={handleInputChange}
                    placeholder="1968..." 
                    className="w-full p-3 bg-slate-50 text-sm rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1.5 uppercase">Tanda Tangan</label>
                  <label className="group flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all overflow-hidden relative">
                    {!images.ttd ? (
                      <div className="flex flex-col items-center text-slate-400">
                        <Upload className="w-5 h-5" />
                        <p className="text-[10px] mt-2 font-bold uppercase">Unggah TTD</p>
                      </div>
                    ) : (
                      <img src={images.ttd} className="h-full object-contain p-2" alt="TTD" />
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'ttd')} />
                  </label>
                </div>
              </div>
            </section>

            {/* Photos */}
            <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-2 mb-6">
                <Camera className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Dokumentasi</h3>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <label key={i} className="group flex flex-col items-center justify-center aspect-square border-2 border-dashed border-slate-200 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-all overflow-hidden relative">
                    {!images[`foto${i}`] ? (
                      <ImageIcon className="w-4 h-4 text-slate-300" />
                    ) : (
                      <img src={images[`foto${i}`]} className="w-full h-full object-cover" alt={`Foto ${i}`} />
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, `foto${i}`)} />
                  </label>
                ))}
              </div>
            </section>
          </div>

          {/* Main Form */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
              <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-3 mb-8">
                <span className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white text-sm">1</span>
                Data Pendampingan
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold text-slate-400 block mb-2 uppercase tracking-widest">Satuan Pendidikan (Sekolah) *</label>
                  <input 
                    type="text" id="namaSekolah" required
                    value={form.namaSekolah} onChange={handleInputChange}
                    placeholder="Masukkan nama sekolah..." 
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 text-lg font-medium outline-none focus:ring-4 focus:ring-indigo-50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-2 uppercase tracking-widest">Tanggal Kegiatan</label>
                  <input 
                    type="date" id="tanggal" 
                    value={form.tanggal} onChange={handleInputChange}
                    className="w-full p-3.5 bg-slate-50 rounded-xl border border-slate-200 outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold text-slate-400 block mb-2 uppercase tracking-widest">Jenis Kegiatan</label>
                  <select 
                    id="jenisKegiatan" 
                    value={form.jenisKegiatan} onChange={handleInputChange}
                    className="w-full p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-sm outline-none appearance-none"
                  >
                    <option value="">-- Pilih --</option>
                    {OPTIONS.kegiatan.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                {/* Tema Spesifik */}
                <div className="md:col-span-2">
                  <label className="text-[11px] font-bold text-slate-400 block mb-2 uppercase tracking-widest">Tema Spesifik (Sesuai Kebutuhan)</label>
                  <input 
                    type="text" id="temaSpesifik" 
                    value={form.temaSpesifik} onChange={handleInputChange}
                    placeholder="Masukkan tema spesifik laporan..." 
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm outline-none focus:ring-4 focus:ring-indigo-50 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-8">
                {/* Selectors */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { id: 'model', label: 'Model', options: OPTIONS.model },
                    { id: 'pendekatan', label: 'Pendekatan', options: OPTIONS.pendekatan },
                    { id: 'metode', label: 'Metode', options: OPTIONS.metode },
                    { id: 'strategi', label: 'Strategi', options: OPTIONS.strategi }
                  ].map(s => (
                    <div key={s.id}>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase">{s.label}</label>
                      <select 
                        id={s.id} value={form[s.id as keyof FormState]} onChange={handleInputChange}
                        className="w-full p-2.5 text-xs bg-slate-50 rounded-lg border border-slate-200 outline-none"
                      >
                        <option value="">-- Pilih --</option>
                        {s.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Fokus Intervensi - MOVED HERE */}
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    Fokus Intervensi (Pilar 1-4)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {OPTIONS.pilar.map(p => (
                      <div key={p.title} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase mb-3 tracking-wider">{p.title}</p>
                        <div className="space-y-2">
                          {p.items.map(item => (
                            <label key={item} className="flex items-start gap-3 cursor-pointer group">
                              <input 
                                type="checkbox" 
                                checked={form.pilar.includes(item)}
                                onChange={() => handleCheckboxChange(item)}
                                className="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors">{item}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Narrative */}
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-2 uppercase tracking-widest">Narasi / Temuan Lapangan</label>
                  <textarea 
                    id="catatan" rows={4} 
                    value={form.catatan} onChange={handleInputChange}
                    placeholder="Ketikkan poin-poin temuan atau catatan khusus..." 
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm outline-none focus:ring-4 focus:ring-indigo-50 transition-all"
                  ></textarea>
                </div>

                {/* Kepsek validation */}
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-700 mb-4">Pengesahan Kepala Sekolah</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <input 
                        type="text" id="namaKepsek" 
                        value={form.namaKepsek} onChange={handleInputChange}
                        placeholder="Nama Kepala Sekolah" 
                        className="w-full p-3 bg-white text-sm rounded-xl border border-slate-200 mb-2 outline-none"
                      />
                      <input 
                        type="text" id="nipKepsek" 
                        value={form.nipKepsek} onChange={handleInputChange}
                        placeholder="NIP Kepala Sekolah" 
                        className="w-full p-3 bg-white text-sm rounded-xl border border-slate-200 outline-none"
                      />
                    </div>
                    <label className="group flex flex-col items-center justify-center w-full min-h-[100px] border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer bg-white hover:bg-slate-50 transition-all overflow-hidden relative">
                      {!images.ttdKepsek ? (
                        <div className="flex flex-col items-center text-slate-400">
                          <Plus className="w-4 h-4" />
                          <p className="text-[9px] mt-1 font-bold uppercase">TTD KEPSEK</p>
                        </div>
                      ) : (
                        <img src={images.ttdKepsek} className="h-full object-contain p-2" alt="TTD Kepsek" />
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'ttdKepsek')} />
                    </label>
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <div className="mt-12">
                <button 
                  onClick={generateReport}
                  disabled={loading}
                  className={cn(
                    "w-full py-4 text-white rounded-2xl font-bold transition-all flex justify-center items-center gap-3 shadow-xl shadow-slate-200 text-lg",
                    loading ? "bg-slate-400 cursor-not-allowed" : "bg-slate-900 hover:bg-slate-800 active:scale-[0.99]"
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      MEMPROSES LAPORAN...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 text-yellow-400" />
                      GENERATE LAPORAN AI
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Output Section */}
        <AnimatePresence>
          {report && (
            <motion.div 
              id="output-section"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 pt-10"
              ref={outputRef}
            >
              <div className="flex flex-col sm:flex-row justify-between items-center bg-white border border-slate-200 p-5 rounded-3xl shadow-xl sticky bottom-4 z-40">
                <div className="flex items-center gap-4 mb-4 sm:mb-0">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100">
                    <FileCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Laporan AI Siap!</p>
                    <p className="text-xs text-slate-500">Telah dioptimalkan berdasarkan data Anda.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button 
                    onClick={exportWord}
                    className="w-full sm:w-64 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-100 text-lg"
                  >
                    <Download className="w-5 h-5" /> UNDUH LAPORAN (WORD)
                  </button>
                </div>
              </div>

              <div className="flex justify-center">
                <div 
                  id="report-paper" 
                  className="bg-white w-full max-w-[210mm] min-h-[297mm] px-[20mm] py-[25mm] shadow-2xl border border-slate-100 text-slate-900 relative box-border overflow-hidden"
                >
                  <div className="prose prose-slate max-w-none prose-sm sm:prose-base 
                    prose-headings:font-bold prose-headings:text-slate-900 prose-headings:uppercase prose-headings:text-center prose-headings:mt-10 prose-headings:mb-8
                    prose-p:text-justify prose-p:leading-relaxed prose-p:mb-5
                    prose-table:border-collapse prose-table:w-full prose-table:my-8 prose-table:text-[13px] prose-table:table-auto
                    prose-th:bg-slate-50 prose-th:text-slate-900 prose-th:text-center prose-th:border-[0.5px] prose-th:border-slate-800 prose-th:p-4 prose-th:font-bold
                    prose-td:border-[0.5px] prose-td:border-slate-800 prose-td:p-4 prose-td:align-top prose-td:text-slate-800 prose-td:leading-normal
                    prose-img:rounded-xl prose-li:text-justify prose-li:leading-relaxed"
                    style={{ fontFamily: "'Times New Roman', Times, serif" }}
                  >
                    <ReactMarkdown>{report}</ReactMarkdown>
                  </div>
                  
                  {/* Digital Signature Footer */}
                  <div className="mt-16 pt-8 w-full text-sm border-t border-slate-100">
                    <table className="w-full border-none !border-0 text-center">
                      <tbody className="border-none">
                        <tr className="border-none">
                          <td className="w-1/2 p-4 align-top border-none !border-0">
                            <p>Mengetahui,</p>
                            <p className="font-bold">Kepala Sekolah</p>
                            <div className="h-24 flex items-center justify-center my-2">
                              {images.ttdKepsek && (
                                <img src={images.ttdKepsek} className="max-h-20 max-w-[150px] object-contain" alt="Signature" />
                              )}
                            </div>
                            <p className="font-bold underline uppercase">{form.namaKepsek || "................"}</p>
                            <p className="text-xs">NIP. {form.nipKepsek || "................"}</p>
                          </td>
                          <td className="w-1/2 p-4 align-top border-none !border-0">
                            <p>Kabupaten Purbalingga, {form.tanggal ? new Date(form.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : "................"}</p>
                            <p className="font-bold">Pengawas Sekolah</p>
                            <div className="h-24 flex items-center justify-center my-2">
                              {images.ttd && (
                                <img src={images.ttd} className="max-h-20 max-w-[150px] object-contain" alt="Signature" />
                              )}
                            </div>
                            <p className="font-bold underline uppercase">{form.namaPengawas || "Sasno, S.Pd., M.Pd."}</p>
                            <p className="text-xs">NIP. {form.nipPengawas || "196811201992031004"}</p>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Documentation Appendix */}
                  <div className="mt-20 pt-10 border-t border-slate-200 page-break-before">
                    <h3 className="text-lg font-bold mb-6 text-center underline uppercase">Lampiran Dokumentasi</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {[1, 2, 3, 4, 5, 6].map(i => images[`foto${i}`] && (
                        <div key={i} className="p-2 border border-slate-200 rounded-xl bg-slate-50">
                          <img src={images[`foto${i}`]} className="w-full aspect-[4/3] object-cover rounded-lg" alt={`Lampiran ${i}`} />
                          <p className="text-[10px] text-center mt-2 text-slate-500 font-medium">FOTO KEGIATAN {i}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl relative"
            >
              <button 
                onClick={() => setShowHelp(false)}
                className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
              
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                <Info className="w-6 h-6" />
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-2">Informasi Aplikasi</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                Aplikasi ini telah dimutakhirkan sesuai dengan <strong>PERMENDIKDASMEN NO 21 & 11 TAHUN 2025</strong> mengenai standar pengawasan dan pendampingan satuan pendidikan.
              </p>

              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-bold">1</div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Keamanan Data</p>
                    <p className="text-xs text-slate-500">Semua input Anda disimpan secara lokal di browser Anda (LocalDraft).</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">2</div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">AI Gemini Powered</p>
                    <p className="text-xs text-slate-500">Menggunakan model bahasa tercanggih untuk menarasikan temuan lapangan Anda.</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowHelp(false)}
                className="w-full mt-8 py-3.5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
              >
                Ok, Mengerti
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-20 border-t border-slate-200 py-10 text-center">
        <p className="text-[10px] text-slate-400 font-bold font-mono uppercase tracking-widest px-4">
          DIKEMBANGKAN SESUAI STANDAR PERMENDIKDASMEN 2025 • PENULIS INTELEKTUAL: SASNO, S.Pd., M.Pd.
        </p>
      </footer>
    </div>
  );
}
