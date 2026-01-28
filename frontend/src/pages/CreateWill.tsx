import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, useFieldArray } from 'react-hook-form';
import toast from 'react-hot-toast';
import { parseEther, keccak256, toHex } from 'viem';
import { useCreateWill } from '../hooks/useWill';

interface BeneficiaryForm {
  address: string;
  name: string;
  allocation: number;
  vestingType: number;
}

interface WillFormData {
  name: string;
  description: string;
  activationMode: number;
  inactivityThreshold: number;
  gracePeriod: number;
  disputePeriod: number;
  backupExecutor: string;
  beneficiaries: BeneficiaryForm[];
}

const STEPS = [
  'Basic Info',
  'Beneficiaries',
  'Settings',
  'Review',
];

function CreateWill() {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();
  const createWillMutation = useCreateWill();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<WillFormData>({
    defaultValues: {
      name: '',
      description: '',
      activationMode: 0,
      inactivityThreshold: 365,
      gracePeriod: 30,
      disputePeriod: 90,
      backupExecutor: '',
      beneficiaries: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'beneficiaries',
  });

  const watchedData = watch();

  const totalAllocation = watchedData.beneficiaries.reduce(
    (sum, b) => sum + (Number(b.allocation) || 0),
    0
  );

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const onSubmit = async (data: WillFormData) => {
    if (currentStep < STEPS.length - 1) {
      nextStep();
      return;
    }

    // Final submission
    try {
      const metadataHash = keccak256(toHex(JSON.stringify({
        name: data.name,
        description: data.description,
      })));

      await createWillMutation.mutateAsync({
        activationMode: data.activationMode,
        inactivityThreshold: BigInt(data.inactivityThreshold * 24 * 60 * 60), // Convert days to seconds
        gracePeriod: BigInt(data.gracePeriod * 24 * 60 * 60),
        disputePeriod: BigInt(data.disputePeriod * 24 * 60 * 60),
        metadataHash: metadataHash as `0x${string}`,
        backupExecutor: (data.backupExecutor || '0x0000000000000000000000000000000000000000') as `0x${string}`,
      });

      toast.success('Will created successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error creating will:', error);
      toast.error('Failed to create will. Please try again.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create Your Will</h1>
        <p className="text-gray-500 mt-1">
          Set up your digital inheritance in a few simple steps
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                  index <= currentStep
                    ? 'bg-primary-700 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {index + 1}
              </div>
              <span
                className={`ml-2 text-sm hidden sm:block ${
                  index <= currentStep ? 'text-primary-700 font-medium' : 'text-gray-500'
                }`}
              >
                {step}
              </span>
              {index < STEPS.length - 1 && (
                <div
                  className={`w-8 sm:w-16 h-0.5 mx-2 ${
                    index < currentStep ? 'bg-primary-700' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="card">
          <AnimatePresence mode="wait">
            {/* Step 1: Basic Info */}
            {currentStep === 0 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>

                <div>
                  <label className="label">Will Name (Optional)</label>
                  <input
                    {...register('name')}
                    type="text"
                    className="input"
                    placeholder="e.g., Main Estate Plan"
                  />
                </div>

                <div>
                  <label className="label">Description (Optional)</label>
                  <textarea
                    {...register('description')}
                    className="input min-h-[100px]"
                    placeholder="Any notes or instructions for your beneficiaries..."
                  />
                </div>

                <div>
                  <label className="label">Activation Mode</label>
                  <select {...register('activationMode', { valueAsNumber: true })} className="input">
                    <option value={0}>Time-Based (Automatic after inactivity)</option>
                    <option value={1}>Notary Verified (Requires death verification)</option>
                    <option value={2}>Hybrid (Both time and notary verification)</option>
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    Time-based is simplest. Hybrid is most secure.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 2: Beneficiaries */}
            {currentStep === 1 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Beneficiaries</h2>
                  <button
                    type="button"
                    onClick={() =>
                      append({ address: '', name: '', allocation: 0, vestingType: 0 })
                    }
                    className="btn-outline btn-sm"
                  >
                    + Add Beneficiary
                  </button>
                </div>

                {fields.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                    <p className="text-gray-500 mb-4">No beneficiaries added yet</p>
                    <button
                      type="button"
                      onClick={() =>
                        append({ address: '', name: '', allocation: 0, vestingType: 0 })
                      }
                      className="btn-primary"
                    >
                      Add Your First Beneficiary
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <div key={field.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-start justify-between mb-4">
                          <h3 className="font-medium text-gray-900">
                            Beneficiary {index + 1}
                          </h3>
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="text-danger-500 hover:text-danger-700"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="label">Name/Label</label>
                            <input
                              {...register(`beneficiaries.${index}.name`)}
                              type="text"
                              className="input"
                              placeholder="e.g., Wife, Son, etc."
                            />
                          </div>
                          <div>
                            <label className="label">Wallet Address</label>
                            <input
                              {...register(`beneficiaries.${index}.address`, {
                                required: 'Address is required',
                                pattern: {
                                  value: /^0x[a-fA-F0-9]{40}$/,
                                  message: 'Invalid address',
                                },
                              })}
                              type="text"
                              className="input"
                              placeholder="0x..."
                            />
                          </div>
                          <div>
                            <label className="label">Allocation (%)</label>
                            <input
                              {...register(`beneficiaries.${index}.allocation`, {
                                valueAsNumber: true,
                                required: 'Allocation is required',
                                min: { value: 1, message: 'Min 1%' },
                                max: { value: 100, message: 'Max 100%' },
                              })}
                              type="number"
                              className="input"
                              placeholder="50"
                            />
                          </div>
                          <div>
                            <label className="label">Vesting</label>
                            <select
                              {...register(`beneficiaries.${index}.vestingType`, {
                                valueAsNumber: true,
                              })}
                              className="input"
                            >
                              <option value={0}>Immediate</option>
                              <option value={1}>Linear (over time)</option>
                              <option value={2}>Cliff (after period)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Allocation Summary */}
                    <div
                      className={`p-4 rounded-lg ${
                        totalAllocation === 100
                          ? 'bg-success-50 border border-success-200'
                          : 'bg-warning-50 border border-warning-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Total Allocation</span>
                        <span
                          className={`text-lg font-bold ${
                            totalAllocation === 100 ? 'text-success-600' : 'text-warning-600'
                          }`}
                        >
                          {totalAllocation}%
                        </span>
                      </div>
                      {totalAllocation !== 100 && (
                        <p className="text-sm text-warning-600 mt-1">
                          Total must equal 100% before activation
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Step 3: Settings */}
            {currentStep === 2 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold text-gray-900">Settings</h2>

                <div>
                  <label className="label">Inactivity Threshold (Days)</label>
                  <input
                    {...register('inactivityThreshold', {
                      valueAsNumber: true,
                      required: true,
                      min: 90,
                      max: 1825,
                    })}
                    type="number"
                    className="input"
                    min={90}
                    max={1825}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Will triggers after this many days of no activity (90-1825 days)
                  </p>
                </div>

                <div>
                  <label className="label">Grace Period (Days)</label>
                  <input
                    {...register('gracePeriod', {
                      valueAsNumber: true,
                      required: true,
                      min: 7,
                      max: 90,
                    })}
                    type="number"
                    className="input"
                    min={7}
                    max={90}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Time you have to cancel after trigger (7-90 days)
                  </p>
                </div>

                <div>
                  <label className="label">Dispute Period (Days)</label>
                  <input
                    {...register('disputePeriod', {
                      valueAsNumber: true,
                      required: true,
                      min: 30,
                      max: 180,
                    })}
                    type="number"
                    className="input"
                    min={30}
                    max={180}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Window for filing disputes (30-180 days)
                  </p>
                </div>

                <div>
                  <label className="label">Backup Executor (Optional)</label>
                  <input
                    {...register('backupExecutor', {
                      pattern: {
                        value: /^(0x[a-fA-F0-9]{40})?$/,
                        message: 'Invalid address',
                      },
                    })}
                    type="text"
                    className="input"
                    placeholder="0x..."
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Address that can execute if notaries fail
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 4: Review */}
            {currentStep === 3 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <h2 className="text-xl font-semibold text-gray-900">Review Your Will</h2>

                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">Basic Info</h3>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <dt className="text-gray-500">Name:</dt>
                      <dd className="text-gray-900">{watchedData.name || 'Unnamed Will'}</dd>
                      <dt className="text-gray-500">Activation:</dt>
                      <dd className="text-gray-900">
                        {['Time-Based', 'Notary Verified', 'Hybrid'][watchedData.activationMode]}
                      </dd>
                    </dl>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">
                      Beneficiaries ({watchedData.beneficiaries.length})
                    </h3>
                    {watchedData.beneficiaries.map((b, i) => (
                      <div key={i} className="flex justify-between text-sm py-1">
                        <span className="text-gray-600">
                          {b.name || `Beneficiary ${i + 1}`}
                        </span>
                        <span className="text-gray-900 font-medium">{b.allocation}%</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">Timing</h3>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <dt className="text-gray-500">Inactivity Threshold:</dt>
                      <dd className="text-gray-900">{watchedData.inactivityThreshold} days</dd>
                      <dt className="text-gray-500">Grace Period:</dt>
                      <dd className="text-gray-900">{watchedData.gracePeriod} days</dd>
                      <dt className="text-gray-500">Dispute Period:</dt>
                      <dd className="text-gray-900">{watchedData.disputePeriod} days</dd>
                    </dl>
                  </div>

                  <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
                    <p className="text-sm text-primary-800">
                      By creating this will, you understand that it will be stored immutably
                      onchain and will execute automatically when conditions are met.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            type="button"
            onClick={currentStep === 0 ? () => navigate('/dashboard') : prevStep}
            className="btn-ghost"
          >
            {currentStep === 0 ? 'Cancel' : 'Back'}
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={createWillMutation.isPending}
          >
            {createWillMutation.isPending ? (
              <span className="flex items-center">
                <div className="spinner w-4 h-4 mr-2" />
                Creating...
              </span>
            ) : currentStep === STEPS.length - 1 ? (
              'Create Will'
            ) : (
              'Continue'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateWill;
