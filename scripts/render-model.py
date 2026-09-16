"""Optional diagnostic projection of the authoritative JSON (requires matplotlib)."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Line3DCollection, Poly3DCollection
root=Path(__file__).resolve().parents[1]
m=json.loads((root/'public/bridge/model.json').read_text())
fig=plt.figure(figsize=(14,7),facecolor='#0b1725');ax=fig.add_subplot(projection='3d',facecolor='#0b1725')
def pos(i):
    x,y,z=m['nodes'][i]['position'];return (x,z,y)
colors={'rib':'#75dcdf','root':'#9edbce','deck':'#d7e6f4','floor':'#a4bacb','web':'#87a8b5','fine':'#618897','radial':'#b9cdd4','orb':'#a4ccd0','crown':'#91b6c1','lateral':'#587f91','archbrace':'#c5f0df'}
for kind in colors:
    members=[e for e in m['members'] if e['type']==kind]
    if not members: continue
    ax.add_collection3d(Line3DCollection([[pos(e['a']),pos(e['b'])] for e in members],colors=[{'primary_arch':'#75dcdf','arch_internal':'#c5f0df','deck_system':'#a4bacb','cable_web':'#c4a783','end_support':'#94b8ce'}[e['system']] for e in members],linewidths=[max(.25,e['section']['outerDiameter']*2.5) for e in members],alpha=.9))
ax.add_collection3d(Poly3DCollection([[(-78,-7,0),(78,-7,0),(78,7,0),(-78,7,0)]],facecolor='#526b7b',alpha=.9))
for z in [-6.7,6.7]:
    ax.plot([-78,78],[z,z],[1.35,1.35],color='#b0c7cc',lw=.6)
ax.set(xlim=(-86,86),ylim=(-22,22),zlim=(-13,34));ax.set_box_aspect((172,44,47));ax.view_init(elev=19,azim=-57);ax.set_axis_off()
fig.subplots_adjust(0,0,1,1);fig.text(.06,.92,'HYBRID BRIDGE / THICK ARCHES + TENSILE WEB',color='#d7e6f4',fontsize=14)
fig.text(.06,.86,'Original arch paths  •  internal lattice  •  slender cables  •  open approaches',color='#9ab6c8',fontsize=11)
fig.text(.06,.06,'Diagnostic projection of model.json. Assumed dimensions; conceptual hybrid model.',color='#8096aa',fontsize=10)
fig.savefig(root/'public/bridge/geometry-overview.png',dpi=160,facecolor=fig.get_facecolor());plt.close(fig)
