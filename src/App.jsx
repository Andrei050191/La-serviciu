{/* Sub Header și deasupra listei de membri, inserează acest bloc: */}

{paginaCurenta === 'lista' && (
  <div className="mb-8 bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-2xl animate-in slide-in-from-top duration-500">
    <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-orange-600/20 rounded-xl flex items-center justify-center text-orange-500 border border-orange-500/30">
          <Utensils size={20} />
        </div>
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-white">Masa la Cantină</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase italic">Selectați personalul pentru hrană</p>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-orange-600 px-4 py-1.5 rounded-full border border-orange-400 shadow-lg shadow-orange-900/20">
        <span className="text-xs font-black text-white">{totalLaCantina}</span>
        <span className="text-[10px] font-black text-orange-100 uppercase tracking-tighter">Persoane</span>
      </div>
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
      {echipa.map((m) => {
        const bifat = esteLaCantina(m);
        return (
          <button
            key={`cantina-${m.id}`}
            onClick={() => toggleCantina(m)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-xl border-2 transition-all active:scale-95 ${
              bifat 
              ? 'bg-orange-600 border-orange-400 text-white shadow-lg shadow-orange-900/40' 
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600'
            }`}
          >
            <span className="text-[10px] font-black uppercase truncate mr-2">{m.nume.split(' ').pop()}</span>
            {bifat ? <Check size={12} strokeWidth={4} /> : <div className="w-3 h-3 rounded-full border border-slate-700" />}
          </button>
        );
      })}
    </div>
  </div>
)}
export default App;