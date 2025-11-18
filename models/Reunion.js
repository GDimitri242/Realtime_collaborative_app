// models/Reunion.js
const mongoose = require('mongoose');

const reunionSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    createur: {
        type: String,
        required: true
    },
    createurId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    titre: {
        type: String,
        default: 'Réunion sans titre'
    },
    participants: [{
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        nom: String,
        peerId: String,
        audioActive: {
            type: Boolean,
            default: true
        },
        videoActive: {
            type: Boolean,
            default: true
        },
        dateJoin: {
            type: Date,
            default: Date.now
        }
    }],
    partageEcran: {
        utilisateur: String,
        peerId: String,
        actif: {
            type: Boolean,
            default: false
        }
    },
    dateCreation: {
        type: Date,
        default: Date.now
    },
    dateModification: {
        type: Date,
        default: Date.now
    },
    statut: {
        type: String,
        enum: ['active', 'terminee', 'planifiee'],
        default: 'active'
    },
    invitations: [{
        email: String,
        statut: {
            type: String,
            enum: ['envoyee', 'acceptee', 'refusee'],
            default: 'envoyee'
        },
        dateEnvoi: {
            type: Date,
            default: Date.now
        }
    }],
    lienPublic: {
        type: Boolean,
        default: true
    },
    motDePasse: String,
    duree: {
        type: Number, // en minutes
        default: 0
    }
});

// Mettre à jour dateModification avant sauvegarde
reunionSchema.pre('save', function(next) {
    this.dateModification = Date.now();
    next();
});

// Méthode pour ajouter un participant
reunionSchema.methods.ajouterParticipant = function(participantData) {
    const participantExistant = this.participants.find(p => 
        p.userId && p.userId.toString() === participantData.userId.toString()
    );
    
    if (!participantExistant) {
        this.participants.push(participantData);
    }
    return this.save();
};

// Méthode pour retirer un participant
reunionSchema.methods.retirerParticipant = function(userId) {
    this.participants = this.participants.filter(p => 
        p.userId.toString() !== userId.toString()
    );
    return this.save();
};

// Méthode pour mettre à jour le statut audio/vidéo
reunionSchema.methods.mettreAJourMedia = function(userId, updates) {
    const participant = this.participants.find(p => 
        p.userId.toString() === userId.toString()
    );
    
    if (participant) {
        if (updates.audioActive !== undefined) {
            participant.audioActive = updates.audioActive;
        }
        if (updates.videoActive !== undefined) {
            participant.videoActive = updates.videoActive;
        }
    }
    return this.save();
};

// Méthode statique pour nettoyer les réunions anciennes
reunionSchema.statics.nettoyerAnciennes = function() {
    const dateLimite = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 heures
    return this.deleteMany({ 
        statut: 'terminee',
        dateModification: { $lt: dateLimite }
    });
};

module.exports = mongoose.model('Reunion', reunionSchema);