<?php

namespace App\Http\Requests;

use App\Models\ServiceRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreServiceRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'site_id'     => ['nullable', 'integer', 'exists:sites,id'],
            'device_id'   => ['nullable', 'integer', 'exists:devices,id'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
            'title'       => ['required', 'string', 'max:255'],
            'reason'      => ['nullable', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:5000'],
            'priority'    => ['nullable', Rule::in(ServiceRequest::PRIORITIES)],
            'status'      => ['nullable', Rule::in(ServiceRequest::STATUSES)],
            'desired_at'  => ['nullable', 'date', 'after_or_equal:today'],
        ];
    }

    public function messages(): array
    {
        return [
            'customer_id.required' => 'Le client est obligatoire.',
            'customer_id.exists'   => 'Ce client n\'existe pas.',
            'title.required'       => 'Le titre de la demande est obligatoire.',
            'description.required' => 'La description est obligatoire.',
            'priority.in'          => 'Priorité invalide. Valeurs acceptées : critical, high, normal, low.',
            'status.in'            => 'Statut invalide.',
            'desired_at.after_or_equal' => 'La date souhaitée ne peut pas être dans le passé.',
        ];
    }
}
